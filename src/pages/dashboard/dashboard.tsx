import React from 'react';
import { observer } from 'mobx-react-lite';
import Money from '@/components/shared_ui/money';
import { TContractInfo } from '@/components/summary/summary-card.types';
import { DBOT_TABS } from '@/constants/bot-contents';
import { transaction_elements } from '@/constants/transactions';
import { CONNECTION_STATUS } from '@/external/bot-skeleton/services/api/observables/connection-status-stream';
import { useApiBase } from '@/hooks/useApiBase';
import { useStore } from '@/hooks/useStore';
import { STRATEGIES } from '@/pages/bot-builder/quick-strategy/config';
import { localize } from '@deriv-com/translations';
import { useDevice } from '@deriv-com/ui';
import OnboardTourHandler from '../tutorials/dbot-tours/onboarding-tour';
import AnalysisTools from './analysis-tools';
import Announcements from './announcements';
import Cards from './cards';
import InfoPanel from './info-panel';

type TMobileIconGuide = {
    handleTabChange: (active_number: number) => void;
};

const DashboardComponent = observer(({ handleTabChange }: TMobileIconGuide) => {
    const { load_modal, dashboard, client, run_panel, summary_card, quick_strategy, transactions } = useStore();
    const { dashboard_strategies } = load_modal;
    const { active_tab } = dashboard;
    const has_dashboard_strategies = !!dashboard_strategies?.length;
    const { isDesktop, isTablet } = useDevice();
    const { connectionStatus } = useApiBase();
    const is_connected = connectionStatus === CONNECTION_STATUS.OPENED;
    const is_bot_active = run_panel.is_running || run_panel.has_open_contract;
    const contract = summary_card.contract_info as {
        buy_price?: number;
        contract_type?: string;
        currency?: string;
        is_sold?: boolean;
        profit?: number;
        underlying_symbol?: string;
    } | null;
    const quick_strategies = Object.values(STRATEGIES());
    const recent_contracts = transactions.transactions
        .filter(
            transaction =>
                transaction.type === transaction_elements.CONTRACT &&
                typeof transaction.data === 'object' &&
                transaction.data !== null
        )
        .slice(0, 5)
        .map(({ data }) => data as TContractInfo);

    const open_bot_builder = () => dashboard.setActiveTab(DBOT_TABS.BOT_BUILDER);
    const open_chart = () => dashboard.setActiveTab(DBOT_TABS.CHART);
    const open_strategy_picker = () => {
        dashboard.setActiveTab(DBOT_TABS.BOT_BUILDER);
        quick_strategy.setFormVisibility(true);
    };

    return (
        <div className='terminal-dashboard'>
            {client.is_logged_in && (
                <Announcements is_mobile={!isDesktop} is_tablet={isTablet} handleTabChange={handleTabChange} />
            )}

            <header className='terminal-dashboard__header'>
                <div>
                    <p className='terminal-dashboard__eyebrow'>KEVDOLLARAI / TRADING TERMINAL</p>
                    <h1>{localize('Trading terminal')}</h1>
                    <p>{localize('Manage your bots, monitor positions, and explore market tools.')}</p>
                </div>
                <div className='terminal-dashboard__connection' aria-live='polite'>
                    <span className={is_connected ? 'is-connected' : ''} />
                    {is_connected ? localize('Deriv connected') : localize('Connecting to Deriv')}
                </div>
            </header>

            <section className='terminal-dashboard__overview' aria-label={localize('Account and bot overview')}>
                <article className='terminal-dashboard__metric terminal-dashboard__metric--balance'>
                    <span className='terminal-dashboard__metric-label'>{localize('Account balance')}</span>
                    <strong>
                        {client.is_logged_in ? (
                            <Money amount={Number(client.balance) || 0} currency={client.currency} show_currency />
                        ) : (
                            localize('Connect an account')
                        )}
                    </strong>
                    <span className='terminal-dashboard__metric-detail'>
                        {client.is_logged_in
                            ? `${client.is_virtual ? localize('Demo account') : localize('Real account')} | ${client.loginid}`
                            : localize('Your live account balance will appear here.')}
                    </span>
                </article>

                <article className='terminal-dashboard__metric'>
                    <span className='terminal-dashboard__metric-label'>{localize('Bot status')}</span>
                    <strong>{is_bot_active ? localize('Active') : localize('Ready')}</strong>
                    <span className='terminal-dashboard__metric-detail'>
                        {is_bot_active ? localize('Bot execution is in progress.') : localize('No bot is running.')}
                    </span>
                </article>

                <article className='terminal-dashboard__metric'>
                    <span className='terminal-dashboard__metric-label'>
                        {contract?.is_sold ? localize('Latest contract') : localize('Live contract')}
                    </span>
                    <strong>
                        {contract
                            ? contract.underlying_symbol || contract.contract_type || localize('Contract')
                            : run_panel.is_running
                              ? localize('Waiting for contract')
                              : localize('No active contract')}
                    </strong>
                    <span className='terminal-dashboard__metric-detail'>
                        {contract ? (
                            <>
                                {localize('Stake')}{' '}
                                <Money
                                    amount={Number(contract.buy_price) || 0}
                                    currency={contract.currency || client.currency}
                                    show_currency
                                />
                                <span className='terminal-dashboard__metric-profit'>
                                    <Money
                                        amount={Number(contract.profit) || 0}
                                        currency={contract.currency || client.currency}
                                        has_sign
                                        show_currency
                                    />
                                </span>
                            </>
                        ) : (
                            localize('Open positions will appear here.')
                        )}
                    </span>
                </article>

                <article className='terminal-dashboard__metric'>
                    <span className='terminal-dashboard__metric-label'>{localize('Saved bots')}</span>
                    <strong>{dashboard_strategies.length}</strong>
                    <span className='terminal-dashboard__metric-detail'>
                        {localize('Available in your workspace.')}
                    </span>
                </article>
            </section>

            <section className='terminal-dashboard__section terminal-dashboard__activity'>
                <div className='terminal-dashboard__section-heading'>
                    <div>
                        <h2>{localize('Contract activity')}</h2>
                        <p>{localize('Live updates and recent results from your current account.')}</p>
                    </div>
                </div>
                {recent_contracts.length ? (
                    <div className='terminal-dashboard__activity-scroll'>
                        <table className='terminal-dashboard__activity-table'>
                            <thead>
                                <tr>
                                    <th>{localize('Market')}</th>
                                    <th>{localize('Contract')}</th>
                                    <th>{localize('Status')}</th>
                                    <th>{localize('Stake')}</th>
                                    <th>{localize('Profit / loss')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recent_contracts.map((item, index) => (
                                    <tr key={`${item.contract_id ?? item.transaction_ids?.buy ?? index}`}>
                                        <td>{item.underlying_symbol || item.underlying || localize('Market')}</td>
                                        <td>{item.contract_type || localize('Contract')}</td>
                                        <td>
                                            <span
                                                className={
                                                    item.is_completed
                                                        ? 'terminal-dashboard__contract-status terminal-dashboard__contract-status--settled'
                                                        : 'terminal-dashboard__contract-status terminal-dashboard__contract-status--open'
                                                }
                                            >
                                                {item.is_completed ? localize('Settled') : localize('Open')}
                                            </span>
                                        </td>
                                        <td>
                                            <Money
                                                amount={Number(item.buy_price) || 0}
                                                currency={item.currency || client.currency}
                                                show_currency
                                            />
                                        </td>
                                        <td>
                                            <Money
                                                amount={Number(item.profit) || 0}
                                                currency={item.currency || client.currency}
                                                has_sign
                                                show_currency
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className='terminal-dashboard__activity-empty'>
                        {localize('No contract activity yet. Run a bot to see positions and results here.')}
                    </div>
                )}
            </section>

            <section className='terminal-dashboard__section terminal-dashboard__workspace'>
                <div className='terminal-dashboard__section-heading'>
                    <div>
                        <h2>{localize('Your workspace')}</h2>
                        <p>{localize('Load an existing strategy or start building a new bot.')}</p>
                    </div>
                    <button type='button' className='terminal-dashboard__text-action' onClick={open_bot_builder}>
                        {localize('Open Bot Builder')}
                    </button>
                </div>
                <Cards has_dashboard_strategies={has_dashboard_strategies} is_mobile={!isDesktop} />
            </section>

            <section className='terminal-dashboard__section'>
                <div className='terminal-dashboard__section-heading'>
                    <div>
                        <h2>{localize('Analysis tools')}</h2>
                        <p>{localize('Use the existing chart and Blockly indicator tools.')}</p>
                    </div>
                </div>
                <div className='terminal-dashboard__tools'>
                    <button type='button' className='terminal-dashboard__tool' onClick={open_chart}>
                        <span className='terminal-dashboard__tool-index'>01</span>
                        <span>
                            <strong>{localize('Market charts')}</strong>
                            <small>{localize('Open live charts and market views.')}</small>
                        </span>
                        <span>{localize('Open')}</span>
                    </button>
                    <button type='button' className='terminal-dashboard__tool' onClick={open_bot_builder}>
                        <span className='terminal-dashboard__tool-index'>02</span>
                        <span>
                            <strong>{localize('Technical indicators')}</strong>
                            <small>{localize('SMA, EMA, RSI, MACD, and Bollinger Bands in Blockly.')}</small>
                        </span>
                        <span>{localize('Open')}</span>
                    </button>
                </div>
                <AnalysisTools is_active={active_tab === DBOT_TABS.DASHBOARD} />
            </section>

            <section className='terminal-dashboard__section terminal-dashboard__store'>
                <div className='terminal-dashboard__section-heading'>
                    <div>
                        <h2>{localize('Bot Store')}</h2>
                        <p>{localize('Start from one of the built-in quick strategy templates.')}</p>
                    </div>
                    <button type='button' className='terminal-dashboard__text-action' onClick={open_strategy_picker}>
                        {localize('Browse templates')}
                    </button>
                </div>
                <div className='terminal-dashboard__templates'>
                    {quick_strategies.map(strategy => (
                        <button
                            className='terminal-dashboard__template'
                            key={strategy.name}
                            onClick={open_strategy_picker}
                            type='button'
                        >
                            <span>{strategy.label}</span>
                            <small>{localize('Built-in template')}</small>
                        </button>
                    ))}
                </div>
            </section>

            <InfoPanel />
            {active_tab === 0 && <OnboardTourHandler is_mobile={!isDesktop} />}
        </div>
    );
});

export default DashboardComponent;
