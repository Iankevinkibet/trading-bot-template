import { fireEvent, render, screen } from '@testing-library/react';
import ChunkLoader from '../chunk-loader';

describe('<ChunkLoader />', () => {
    it('shows the brand logo and loading message', () => {
        render(<ChunkLoader message='Initializing account...' />);

        expect(screen.getByRole('img', { name: 'KevDollarAI' })).toBeInTheDocument();
        expect(screen.getByRole('status')).toHaveTextContent('Initializing account...');
    });

    it('shows a retry action when initialization fails', () => {
        const onRetry = jest.fn();

        render(<ChunkLoader message='Initializing account...' error='Unable to load markets.' onRetry={onRetry} />);

        expect(screen.getByRole('alert')).toHaveTextContent('Unable to load markets.');
        fireEvent.click(screen.getByRole('button'));
        expect(onRetry).toHaveBeenCalledTimes(1);
    });
});
