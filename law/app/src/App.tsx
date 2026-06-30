import { BrowserRouter, Route, Routes } from 'react-router';
import { AppShell } from '@/routes/AppShell';
import HomePlaceholder from '@/routes/HomePlaceholder';
import JurisdictionPlaceholder from '@/routes/JurisdictionPlaceholder';
import Reader from '@/routes/Reader';
import SearchPlaceholder from '@/routes/SearchPlaceholder';
import NotFound from '@/routes/NotFound';
import { Toaster } from '@/components/ui/sonner';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<HomePlaceholder />} />
          <Route path="/j/:jurId" element={<JurisdictionPlaceholder />} />
          <Route path="/j/:jurId/n/*" element={<Reader />} />
          <Route path="/search" element={<SearchPlaceholder />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
      <Toaster richColors />
    </BrowserRouter>
  );
}
