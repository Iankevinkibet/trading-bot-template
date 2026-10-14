import React from 'react';
import './footer.scss';

const Footer: React.FC = () => {
    return (
        <footer className="chichi-footer">
            <div className="container chichi-footer__inner">
                <div className="chichi-footer__brand">
                    <img src="/assets/logo-footer.svg" alt="Chichi Traders" />
                    <p className="chichi-footer__copy">© {new Date().getFullYear()} Chichi Traders. All rights reserved.</p>
                </div>

                <div className="chichi-footer__links">
                    <div className="chichi-footer__col">
                        <a href="/terms">Terms</a>
                        <a href="/privacy">Privacy</a>
                    </div>
                    <div className="chichi-footer__col">
                        <a href="/help">Help Center</a>
                        <a href="/contact">Contact</a>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
