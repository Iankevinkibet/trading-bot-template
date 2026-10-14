import React from 'react';
import './header.scss';

type Props = {
    isAuthenticating?: boolean;
};

const AppHeader: React.FC<Props> = ({ isAuthenticating = false }) => {
    return (
        <header className="chichi-header">
            <div className="container chichi-header__inner">
                <a className="chichi-header__logo" href="/" aria-label="Home">
                    {/* Replace /assets/logo.svg with your logo file or adjust path */}
                    <img src="/assets/logo.svg" alt="Chichi Traders" />
                </a>

                <nav className="chichi-header__nav" aria-label="Main navigation">
                    <a href="/" className="chichi-nav__link">Home</a>
                    <a href="/features" className="chichi-nav__link">Features</a>
                    <a href="/pricing" className="chichi-nav__link">Pricing</a>
                    <a href="/docs" className="chichi-nav__link">Docs</a>
                </nav>

                <div className="chichi-header__actions">
                    <button className="btn btn-outline" aria-disabled={isAuthenticating}>
                        {isAuthenticating ? 'Checking…' : 'Sign in'}
                    </button>
                    <a className="btn btn-primary" href="/signup">Get Started</a>
                </div>
            </div>
        </header>
    );
};

export default AppHeader;
