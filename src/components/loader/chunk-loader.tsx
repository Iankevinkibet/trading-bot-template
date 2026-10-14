import { BrandLogo } from '@/components/layout/app-logo/BrandLogo';
import { localize } from '@deriv-com/translations';
import './chunk-loader.scss';

type TChunkLoaderProps = {
    message: string;
    error?: string | null;
    onRetry?: () => void;
};

export default function ChunkLoader({ message, error, onRetry }: TChunkLoaderProps) {
    return (
        <main className='brand-loader' aria-busy={!error}>
            <section className='brand-loader__content'>
                <div className='brand-loader__mark'>
                    <span className='brand-loader__ring brand-loader__ring--outer' />
                    <span className='brand-loader__ring brand-loader__ring--inner' />
                    <BrandLogo width={96} height={96} className='brand-loader__logo' />
                </div>
                <p className='brand-loader__eyebrow'>KEVDOLLARAI</p>
                <p className='brand-loader__message' role={error ? undefined : 'status'}>
                    {message}
                </p>
                {!error && (
                    <div className='brand-loader__activity' aria-hidden='true'>
                        <span />
                        <span />
                        <span />
                    </div>
                )}
                {error && (
                    <div className='brand-loader__error' role='alert'>
                        <p>{error}</p>
                        {onRetry && (
                            <button className='brand-loader__retry' type='button' onClick={onRetry}>
                                {localize('Try again')}
                            </button>
                        )}
                    </div>
                )}
            </section>
        </main>
    );
}
