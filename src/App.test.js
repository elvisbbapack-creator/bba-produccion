import { render, screen } from '@testing-library/react';
import App from './App';

test('renders BBA login screen', () => {
  render(<App />);
  expect(
    screen.getByRole('heading', {
      name: /acceso bba/i
    })
  ).toBeInTheDocument();
});
