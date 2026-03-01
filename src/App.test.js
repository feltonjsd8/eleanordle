import { render, screen } from '@testing-library/react';
import App from './App';

test('renders Eleanordle', () => {
  render(<App />);
  expect(screen.getByTitle('Eleanordle')).toBeInTheDocument();
});
