import { RouterProvider } from 'react-router-dom';
import { PortfolioSavedProvider } from './providers';
import { router } from './routes';

export function App() {
  return (
    <PortfolioSavedProvider>
      <RouterProvider router={router} />
    </PortfolioSavedProvider>
  );
}
