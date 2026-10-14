type TBrandLogoProps = {
    width?: number;
    height?: number;
    fill?: string;
    className?: string;
};

export const BrandLogo = ({
    width = 40,
    height = 40,
    className = '',
}: TBrandLogoProps) => {
    return (
        <img
            src='/assets/images/kevdollarai-logo.png'
            width={width}
            height={height}
            className={className}
            alt='KevDollarAI'
            style={{ objectFit: 'contain' }}
        />
    );
};
