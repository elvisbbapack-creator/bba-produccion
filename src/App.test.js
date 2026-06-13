import { render, screen } from '@testing-library/react';
import { getDocs } from 'firebase/firestore';
import App from './App';

jest.mock('./firebase', () => ({
  app: {},
  db: {}
}));

jest.mock('firebase/firestore', () => ({
  addDoc: jest.fn(),
  collection: jest.fn(),
  deleteDoc: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  limit: jest.fn(),
  orderBy: jest.fn(),
  query: jest.fn(),
  runTransaction: jest.fn(),
  serverTimestamp: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  where: jest.fn(),
  writeBatch: jest.fn()
}));

beforeEach(() => {
  getDocs.mockImplementation(
    () => new Promise(() => {})
  );
});

test('renders BBA login screen', () => {
  render(<App />);
  expect(
    screen.getByRole('heading', {
      name: /acceso bba/i
    })
  ).toBeInTheDocument();
});
