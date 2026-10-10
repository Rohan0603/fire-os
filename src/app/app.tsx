import { RouterProvider } from 'react-router-dom';
import { PortfolioSavedProvider } from './providers';
import { router } from './routes';
import { Toaster } from './ui';

export function App() {
  return (
    <PortfolioSavedProvider>
      <Toaster />
      <RouterProvider router={router} />
    </PortfolioSavedProvider>
  );
}
