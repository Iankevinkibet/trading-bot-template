import React, { useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { ToastContainer } from 'react-toastify';
import AuthLoadingWrapper from '@/components/auth-loading-wrapper';
import useLiveChat from '@/components/chat/useLiveChat';
import ChunkLoader from '@/components/loader/chunk-loader';
import { getUrlBase } from '@/components/shared';
import TransactionDetailsModal from '@/components/transaction-details';
import { api_base, ApiHelpers, ServerTime } from '@/external/bot-skeleton';
import { CONNECTION_STATUS } from '@/external/bot-skeleton/services/api/observables/connection-status-stream';
import { useApiBase } from '@/hooks/useApiBase';
import useDevMode from '@/hooks/useDevMode';
import { useStore } from '@/hooks/useStore';
import useThemeSwitcher from '@/hooks/useThemeSwitcher';
import { ThemeProvider } from '@deriv-com/quill-ui';
import { setSmartChartsPublicPath } from '@deriv-com/smartcharts-champion';
import { localize } from '@deriv-com/translations';
import Audio from '../components/audio';
import BlocklyLoading from '../components/blockly-loading';
import BotStopped from '../components/bot-stopped';
import BotBuilder from '../pages/bot-builder';
import Main from '../pages/main';
import './app.scss';
import 'react-toastify/dist/ReactToastify.css';
import '../components/bot-notification/bot-notification.scss';

const AppContent = observer(() => {
    const [is_api_initialized, setIsApiInitialized] = React.useState(false);
    const [is_loading, setIsLoading] = React.useState(true);
    const [loading_error, setLoadingError] = React.useState(null);

    const store = useStore();
    const { app, transactions, common, client } = store;
    const { is_dark_mode_on } = useThemeSwitcher();

    const { recovered_transactions, recoverPendingContracts } = transactions;
    const is_subscribed_to_msg_listener = React.useRef(false);
    const msg_listener = React.useRef(null);
    const active_symbols_interval = React.useRef(null);
    const active_symbols_timeout = React.useRef(null);
    const active_symbols_attempt = React.useRef(0);
    const { connectionStatus } = useApiBase();

    // Initialize dev mode keyboard shortcuts
    useDevMode();

    const livechat_client_information = {
        is_client_store_initialized: client?.is_logged_in ? true : !!client,
        is_logged_in: client?.is_logged_in,
        loginid: client?.loginid,
        currency: client?.currency,
        residence: client?.residence,
        email: '',
        first_name: '',
        last_name: '',
    };

    useLiveChat(livechat_client_information);

    // NOTE: Disabled Intercom until further notice
    // const token = V2GetActiveToken() ?? null;
    // useIntercom(token);

    useEffect(() => {
        if (connectionStatus === CONNECTION_STATUS.OPENED) {
            setIsApiInitialized(true);
            setLoadingError(null);
            common.setSocketOpened(true);
        } else if (connectionStatus !== CONNECTION_STATUS.OPENED) {
            common.setSocketOpened(false);
        }
    }, [common, connectionStatus]);

    React.useEffect(() => {
        if (is_api_initialized) return undefined;

        const timeoutId = setTimeout(() => {
            console.error('Trading API connection did not initialize within 20 seconds');
            setLoadingError(localize('Unable to connect to the trading service. Check your connection and try again.'));
        }, 20000);

        return () => clearTimeout(timeoutId);
    }, [is_api_initialized]);

    const { current_language } = common;
    const html = document.documentElement;
    React.useEffect(() => {
        html?.setAttribute('lang', current_language.toLowerCase());
        html?.setAttribute('dir', current_language.toLowerCase() === 'ar' ? 'rtl' : 'ltr');
    }, [current_language, html]);

    const handleMessage = React.useCallback(
        ({ data }) => {
            if (data?.msg_type === 'proposal_open_contract' && !data?.error) {
                const { proposal_open_contract } = data;
                if (
                    proposal_open_contract?.status !== 'open' &&
                    !recovered_transactions?.includes(proposal_open_contract?.contract_id)
                ) {
                    recoverPendingContracts(proposal_open_contract);
                }
            }
        },
        [recovered_transactions, recoverPendingContracts]
    );

    React.useEffect(() => {
        setSmartChartsPublicPath(getUrlBase('/js/smartcharts/'));
    }, []);

    React.useEffect(() => {
        // Check if api is initialized and then subscribe to the api messages
        // Also we should only subscribe to the messages once user is logged in
        // And is not already subscribed to the messages
        if (!is_subscribed_to_msg_listener.current && client.is_logged_in && is_api_initialized && api_base?.api) {
            is_subscribed_to_msg_listener.current = true;
            msg_listener.current = api_base.api.onMessage()?.subscribe(handleMessage);
        }
        return () => {
            if (is_subscribed_to_msg_listener.current && msg_listener.current) {
                is_subscribed_to_msg_listener.current = false;
                msg_listener.current.unsubscribe?.();
            }
        };
    }, [is_api_initialized, client.is_logged_in, client.loginid, handleMessage, connectionStatus]);

    const init = () => {
        ServerTime.init(common);
        app.setDBotEngineStores();
        ApiHelpers.setInstance(app.api_helpers_store);
        import('@/utils/gtm').then(({ default: GTM }) => {
            GTM.init(store);
        });
    };

    const changeActiveSymbolLoadingState = () => {
        init();
        setIsLoading(true);
        setLoadingError(null);

        const attempt = ++active_symbols_attempt.current;
        if (active_symbols_interval.current) {
            clearInterval(active_symbols_interval.current);
            active_symbols_interval.current = null;
        }
        if (active_symbols_timeout.current) {
            clearTimeout(active_symbols_timeout.current);
            active_symbols_timeout.current = null;
        }

        const failInitialization = error => {
            if (attempt !== active_symbols_attempt.current) return;
            console.error('Trading market initialization failed:', error);
            setLoadingError(localize('Unable to load trading markets. Check your connection and try again.'));
        };

        const retrieveActiveSymbols = async active_symbols => {
            if (active_symbols_interval.current) {
                clearInterval(active_symbols_interval.current);
                active_symbols_interval.current = null;
            }

            let timeoutId;
            try {
                await Promise.race([
                    active_symbols.retrieveActiveSymbols(true),
                    new Promise((_, reject) => {
                        timeoutId = setTimeout(
                            () => reject(new Error('Trading market initialization timed out')),
                            20000
                        );
                        active_symbols_timeout.current = timeoutId;
                    }),
                ]);

                if (attempt !== active_symbols_attempt.current) return;
                if (active_symbols.has_initialization_error) {
                    throw new Error('Trading market initialization returned an error');
                }
                setLoadingError(null);
                setIsLoading(false);
            } catch (error) {
                failInitialization(error);
            } finally {
                clearTimeout(timeoutId);
                if (active_symbols_timeout.current === timeoutId) {
                    active_symbols_timeout.current = null;
                }
            }
        };

        const active_symbols = ApiHelpers?.instance?.active_symbols;
        if (active_symbols) {
            void retrieveActiveSymbols(active_symbols);
            return;
        }

        let checks = 0;
        active_symbols_interval.current = setInterval(() => {
            if (attempt !== active_symbols_attempt.current) return;

            const available_symbols = ApiHelpers?.instance?.active_symbols;
            if (available_symbols) {
                void retrieveActiveSymbols(available_symbols);
            } else if (++checks >= 15) {
                if (active_symbols_interval.current) {
                    clearInterval(active_symbols_interval.current);
                    active_symbols_interval.current = null;
                }
                failInitialization(new Error('Trading market service was not initialized'));
            }
        }, 1000);
    };

    React.useEffect(
        () => () => {
            active_symbols_attempt.current += 1;
            if (active_symbols_interval.current) clearInterval(active_symbols_interval.current);
            if (active_symbols_timeout.current) clearTimeout(active_symbols_timeout.current);
        },
        []
    );

    React.useEffect(() => {
        if (is_api_initialized) {
            init();
            setIsLoading(true);
            if (!client.is_logged_in) {
                changeActiveSymbolLoadingState();
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [is_api_initialized]);

    React.useEffect(() => {
        if (client.is_logged_in && is_api_initialized) {
            changeActiveSymbolLoadingState();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [is_api_initialized, client.loginid]);

    if (common?.error) return null;

    return is_loading ? (
        <ChunkLoader
            message={localize('Initializing Deriv Bot account...')}
            error={loading_error}
            onRetry={loading_error ? () => window.location.reload() : undefined}
        />
    ) : (
        <AuthLoadingWrapper>
            <ThemeProvider theme={is_dark_mode_on ? 'dark' : 'light'}>
                <BlocklyLoading />
                <div className='bot-dashboard bot' data-testid='dt_bot_dashboard'>
                    <Audio />
                    <Main />
                    <BotBuilder />
                    <BotStopped />
                    <TransactionDetailsModal />
                    <ToastContainer limit={3} draggable={false} />
                </div>
            </ThemeProvider>
        </AuthLoadingWrapper>
    );
});

export default AppContent;
