import { useCallback, useEffect, useRef, useState } from 'react';
import { api_base } from '@/external/bot-skeleton';
import { CONNECTION_STATUS } from '@/external/bot-skeleton/services/api/observables/connection-status-stream';
import { useApiBase } from '@/hooks/useApiBase';
import { localize } from '@deriv-com/translations';

type TAnalysisTool = {
    id: string;
    label: string;
    source: string;
};

type TDerivMessage = {
    echo_req?: Record<string, unknown>;
    error?: { message?: string };
    msg_type?: string;
    req_id?: number;
    subscription?: { id?: string };
    tick?: { symbol?: string };
};

type TSocketState = {
    pending_request_ids: Set<number>;
    subscriptions: Set<string>;
    symbol?: string;
};

type TRequestRoute = {
    frame: Window;
    original_request_id?: number;
    socket_id: string;
    symbol?: string;
};

const ANALYSIS_TOOLS: TAnalysisTool[] = [
    { id: 'd-circles', label: 'D-Circles', source: '/analysis-tools/d-circles.source.html' },
    { id: 'over-under', label: 'Over/Under', source: '/analysis-tools/over-under.source.html' },
    { id: 'even-odd', label: 'Even/Odd', source: '/analysis-tools/even-odd.source.html' },
];

const SOCKET_BRIDGE_SCRIPT = `
(function () {
    var sequence = 0;
    var sockets = {};

    function BridgeSocket(url) {
        this.url = url;
        this.readyState = BridgeSocket.CONNECTING;
        this.onopen = null;
        this.onmessage = null;
        this.onerror = null;
        this.onclose = null;
        this._id = 'tool-socket-' + Date.now() + '-' + (++sequence);
        this._events = document.createDocumentFragment();
        this.addEventListener = this._events.addEventListener.bind(this._events);
        this.removeEventListener = this._events.removeEventListener.bind(this._events);
        this.dispatchEvent = this._events.dispatchEvent.bind(this._events);
        sockets[this._id] = this;
        var socket = this;
        window.setTimeout(function () {
            if (socket.readyState !== BridgeSocket.CONNECTING) return;
            socket.readyState = BridgeSocket.OPEN;
            window.parent.postMessage({ channel: 'kev-analysis-bridge', type: 'open', socket_id: socket._id }, '*');
            var event = new Event('open');
            socket.dispatchEvent(event);
            if (socket.onopen) socket.onopen.call(socket, event);
        }, 0);
    }

    BridgeSocket.CONNECTING = 0;
    BridgeSocket.OPEN = 1;
    BridgeSocket.CLOSING = 2;
    BridgeSocket.CLOSED = 3;
    BridgeSocket.prototype.CONNECTING = 0;
    BridgeSocket.prototype.OPEN = 1;
    BridgeSocket.prototype.CLOSING = 2;
    BridgeSocket.prototype.CLOSED = 3;
    BridgeSocket.prototype.send = function (raw) {
        if (this.readyState !== BridgeSocket.OPEN) throw new Error('Deriv connection is not open');
        window.parent.postMessage({
            channel: 'kev-analysis-bridge',
            type: 'request',
            socket_id: this._id,
            request: JSON.parse(raw)
        }, '*');
    };
    BridgeSocket.prototype.close = function () {
        if (this.readyState === BridgeSocket.CLOSED) return;
        this.readyState = BridgeSocket.CLOSED;
        window.parent.postMessage({ channel: 'kev-analysis-bridge', type: 'close', socket_id: this._id }, '*');
        var event = new Event('close');
        this.dispatchEvent(event);
        if (this.onclose) this.onclose.call(this, event);
        delete sockets[this._id];
    };

    window.addEventListener('message', function (event) {
        var message = event.data;
        if (event.source !== window.parent || !message || message.channel !== 'kev-analysis-bridge') return;
        var socket = sockets[message.socket_id];
        if (!socket) return;
        if (message.type === 'transport-close') {
            socket.readyState = BridgeSocket.CLOSED;
            var closeEvent = new Event('close');
            socket.dispatchEvent(closeEvent);
            if (socket.onclose) socket.onclose.call(socket, closeEvent);
            delete sockets[message.socket_id];
            return;
        }
        if (message.type === 'message') {
            var messageEvent = new MessageEvent('message', { data: JSON.stringify(message.payload) });
            socket.dispatchEvent(messageEvent);
            if (socket.onmessage) socket.onmessage.call(socket, messageEvent);
        }
    });

    window.WebSocket = BridgeSocket;
})();
`;

const DCIRCLES_THEME = `
:root,
:root:not([data-theme="dark"]),
:root[data-theme="light"] {
    --bg-1: #eceef1;
    --bg-2: #d7dae0;
    --bg-3: #c3c7cf;
    --card: #f3f4f6;
    --ring-idle: #c9cdd4;
    --ring-track: #dfe2e7;
    --text-main: #16181c;
    --text-dim: #6b7078;
    --green-1: #12c98f;
    --green-2: #0a9e6f;
    --red-1: #ff5b5b;
    --red-2: #d92d2d;
    --blue: #2f7dff;
    --orange: #f59a23;
    --bg: #eceef1;
    --surface: #f3f4f6;
    --surface-2: #ffffff;
    --line: #c9cdd4;
    --fg: #16181c;
    --muted: #6b7078;
    --odd: #d92d2d;
    --even: #2f7dff;
    --good: #0a9e6f;
    --bad: #d92d2d;
    --warn: #f59a23;
    --accent: #d92d2d;
    --glow: #ff5b5b;
    --f-body: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    --f-display: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    --f-mono: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
}

body {
    background: linear-gradient(160deg, #eceef1 0%, #d7dae0 55%, #c3c7cf 100%);
    color: #16181c;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}
`;

const AnalysisTools = ({ is_active }: { is_active: boolean }) => {
    const { connectionStatus, activeLoginid } = useApiBase();
    const [active_tool_id, setActiveToolId] = useState(ANALYSIS_TOOLS[0].id);
    const [src_doc, setSrcDoc] = useState('');
    const [load_error, setLoadError] = useState('');
    const iframe_ref = useRef<HTMLIFrameElement>(null);
    const active_frame_ref = useRef<Window | null>(null);
    const sockets_ref = useRef(new Map<Window, Map<string, TSocketState>>());
    const routes_ref = useRef(new Map<number, TRequestRoute[]>());
    const request_sequence_ref = useRef(1000000);
    const active_ref = useRef(is_active);
    const connected_ref = useRef(connectionStatus === CONNECTION_STATUS.OPENED);

    active_ref.current = is_active;
    connected_ref.current = connectionStatus === CONNECTION_STATUS.OPENED;

    const forget_socket = useCallback((frame: Window, socket_id: string) => {
        const frame_sockets = sockets_ref.current.get(frame);
        const state = frame_sockets?.get(socket_id);
        if (!state) return;

        if (api_base.api) {
            state.subscriptions.forEach(subscription_id => {
                api_base.api?.send({ forget: subscription_id });
            });
        }

        state.pending_request_ids.forEach(request_id => routes_ref.current.delete(request_id));
        frame_sockets?.delete(socket_id);
        if (!frame_sockets?.size) sockets_ref.current.delete(frame);
    }, []);

    const forget_frame = useCallback(
        (frame: Window) => {
            sockets_ref.current.get(frame)?.forEach((_state, socket_id) => forget_socket(frame, socket_id));
            sockets_ref.current.delete(frame);
            routes_ref.current.forEach((routes, request_id) => {
                const remaining = routes.filter(route => route.frame !== frame);
                if (remaining.length) routes_ref.current.set(request_id, remaining);
                else routes_ref.current.delete(request_id);
            });
        },
        [forget_socket]
    );

    const deliver = useCallback((frame: Window, socket_id: string, payload: unknown) => {
        frame.postMessage(
            { channel: 'kev-analysis-bridge', type: 'message', socket_id, payload },
            '*'
        );
    }, []);

    useEffect(() => {
        if (!is_active || connectionStatus !== CONNECTION_STATUS.OPENED) {
            setSrcDoc('');
            setLoadError('');
            if (active_frame_ref.current) {
                forget_frame(active_frame_ref.current);
                active_frame_ref.current = null;
            }
            return;
        }

        let is_cancelled = false;
        const tool = ANALYSIS_TOOLS.find(item => item.id === active_tool_id) ?? ANALYSIS_TOOLS[0];
        setSrcDoc('');
        setLoadError('');

        fetch(tool.source)
            .then(response => {
                if (!response.ok) throw new Error(`Could not load ${tool.label}.`);
                return response.text();
            })
            .then(source => {
                const page = new DOMParser().parseFromString(source, 'text/html');
                page.querySelectorAll('script[src]').forEach(script => script.remove());
                page.querySelectorAll('script').forEach(script => {
                    if (script.textContent?.includes('googtrans=')) script.remove();
                });
                page.querySelectorAll('base').forEach(base => base.remove());

                const base = page.createElement('base');
                base.href = `${window.location.origin}/`;
                page.head.prepend(base);

                page.querySelectorAll('img[src="logo.png"], link[rel="icon"][href="logo.png"]').forEach(asset => {
                    const attribute = asset.tagName === 'LINK' ? 'href' : 'src';
                    asset.setAttribute(attribute, '/assets/images/kevdollarai-logo.png');
                });

                const bridge = page.createElement('script');
                bridge.textContent = SOCKET_BRIDGE_SCRIPT;
                const original_script = [...page.scripts].find(script => !script.src);
                if (original_script) original_script.before(bridge);
                else page.body.prepend(bridge);

                const theme = page.createElement('style');
                theme.textContent = DCIRCLES_THEME;
                page.head.append(theme);

                if (!is_cancelled) setSrcDoc(`<!doctype html>${page.documentElement.outerHTML}`);
            })
            .catch(error => {
                if (!is_cancelled) setLoadError(error instanceof Error ? error.message : localize('Tool unavailable.'));
            });

        return () => {
            is_cancelled = true;
            if (active_frame_ref.current) {
                forget_frame(active_frame_ref.current);
                active_frame_ref.current = null;
            }
        };
    }, [active_tool_id, connectionStatus, forget_frame, is_active]);

    useEffect(() => {
        if (!is_active || connectionStatus !== CONNECTION_STATUS.OPENED) return;

        const handle_bridge_message = (event: MessageEvent) => {
            if (event.source !== active_frame_ref.current || !event.data || event.data.channel !== 'kev-analysis-bridge') {
                return;
            }

            const frame = event.source as Window;
            const { socket_id, type } = event.data as { socket_id?: string; type?: string };
            if (!socket_id) return;

            if (type === 'open') {
                const frame_sockets = sockets_ref.current.get(frame) ?? new Map<string, TSocketState>();
                frame_sockets.set(socket_id, {
                    pending_request_ids: new Set(),
                    subscriptions: new Set(),
                });
                sockets_ref.current.set(frame, frame_sockets);
                return;
            }

            if (type === 'close') {
                forget_socket(frame, socket_id);
                return;
            }

            if (type !== 'request') return;

            const frame_state = sockets_ref.current.get(frame)?.get(socket_id);
            const raw_request = (event.data as { request?: unknown }).request;
            if (!frame_state || !raw_request || typeof raw_request !== 'object') return;

            const request = { ...(raw_request as Record<string, unknown>) };
            if (request.forget_all === 'ticks') {
                frame_state.subscriptions.forEach(subscription_id => {
                    api_base.api?.send({ forget: subscription_id });
                });
                frame_state.subscriptions.clear();
                frame_state.symbol = undefined;
                return;
            }

            if (typeof request.forget === 'string') {
                if (frame_state.subscriptions.has(request.forget)) {
                    api_base.api?.send({ forget: request.forget });
                    frame_state.subscriptions.delete(request.forget);
                }
                return;
            }

            if (!['ticks_history', 'ticks', 'ping'].some(key => key in request)) return;

            const symbol = typeof request.ticks_history === 'string' ? request.ticks_history : request.ticks;
            if (typeof symbol === 'string') frame_state.symbol = symbol;

            const original_request_id = typeof request.req_id === 'number' ? request.req_id : undefined;
            const request_id = ++request_sequence_ref.current;
            request.req_id = request_id;
            frame_state.pending_request_ids.add(request_id);
            const routes = routes_ref.current.get(request_id) ?? [];
            routes.push({ frame, original_request_id, socket_id, symbol: frame_state.symbol });
            routes_ref.current.set(request_id, routes);

            if (!api_base.api || !connected_ref.current) {
                deliver(frame, socket_id, { error: { message: 'Deriv connection is not available.' } });
                return;
            }

            try {
                api_base.api.send(request);
            } catch (error) {
                deliver(frame, socket_id, {
                    error: { message: error instanceof Error ? error.message : 'Deriv request failed.' },
                });
            }
        };

        window.addEventListener('message', handle_bridge_message);
        return () => window.removeEventListener('message', handle_bridge_message);
    }, [connectionStatus, deliver, forget_socket, is_active]);

    useEffect(() => {
        if (!is_active || connectionStatus !== CONNECTION_STATUS.OPENED || !api_base.api) return;

        const subscription = api_base.api.onMessage().subscribe((event: unknown) => {
            const data = (event as { data?: unknown })?.data;
            if (!data || typeof data !== 'object') return;

            const message = data as TDerivMessage;
            const request_id = message.req_id;
            const routes = typeof request_id === 'number' ? routes_ref.current.get(request_id) ?? [] : [];
            const subscription_id = message.subscription?.id;

            routes.forEach(route => {
                const route_state = sockets_ref.current.get(route.frame)?.get(route.socket_id);
                if (!route_state) return;

                if (subscription_id) route_state.subscriptions.add(subscription_id);
                if (message.msg_type === 'tick' && message.tick?.symbol) route_state.symbol = message.tick.symbol;
                deliver(
                    route.frame,
                    route.socket_id,
                    route.original_request_id === undefined
                        ? message
                        : { ...message, req_id: route.original_request_id }
                );
                route_state.pending_request_ids.delete(request_id as number);
            });

            if (routes.length) routes_ref.current.delete(request_id as number);

            if (message.msg_type === 'tick') {
                const tick_subscription_id = message.subscription?.id;
                if (!tick_subscription_id) return;

                sockets_ref.current.forEach((frame_sockets, frame) => {
                    frame_sockets.forEach((state, socket_id) => {
                        const already_delivered = routes.some(
                            route => route.frame === frame && route.socket_id === socket_id
                        );
                        if (
                            !already_delivered &&
                            state.subscriptions.has(tick_subscription_id) &&
                            state.symbol === message.tick?.symbol
                        ) {
                            deliver(frame, socket_id, message);
                        }
                    });
                });
            }
        });

        return () => subscription.unsubscribe();
    }, [activeLoginid, connectionStatus, deliver, is_active]);

    const select_tool = (tool_id: string) => {
        if (active_frame_ref.current) {
            forget_frame(active_frame_ref.current);
            active_frame_ref.current = null;
        }
        setActiveToolId(tool_id);
    };

    const set_frame = useCallback(
        (frame: HTMLIFrameElement | null) => {
            if (!frame && iframe_ref.current?.contentWindow) {
                forget_frame(iframe_ref.current.contentWindow);
            }
            iframe_ref.current = frame;
            active_frame_ref.current = frame?.contentWindow ?? null;
        },
        [forget_frame]
    );

    return (
        <div className='terminal-dashboard__analysis-tools'>
            <div className='terminal-dashboard__analysis-tabs' role='group' aria-label={localize('Analysis tools')}>
                {ANALYSIS_TOOLS.map(tool => (
                    <button
                        key={tool.id}
                        type='button'
                        className={active_tool_id === tool.id ? 'is-active' : ''}
                        aria-pressed={active_tool_id === tool.id}
                        onClick={() => select_tool(tool.id)}
                    >
                        {tool.label}
                    </button>
                ))}
            </div>
            {!is_active ? (
                <div className='terminal-dashboard__analysis-state'>{localize('Open the Dashboard to use analysis tools.')}</div>
            ) : connectionStatus !== CONNECTION_STATUS.OPENED ? (
                <div className='terminal-dashboard__analysis-state'>{localize('Waiting for the Deriv connection.')}</div>
            ) : load_error ? (
                <div className='terminal-dashboard__analysis-state' role='alert'>
                    {load_error}
                </div>
            ) : src_doc ? (
                <iframe
                    ref={set_frame}
                    className='terminal-dashboard__analysis-frame'
                    title={ANALYSIS_TOOLS.find(tool => tool.id === active_tool_id)?.label ?? 'Analysis tool'}
                    sandbox='allow-scripts allow-forms'
                    srcDoc={src_doc}
                />
            ) : (
                <div className='terminal-dashboard__analysis-state' aria-live='polite'>
                    {localize('Loading analysis tool...')}
                </div>
            )}
        </div>
    );
};

export default AnalysisTools;