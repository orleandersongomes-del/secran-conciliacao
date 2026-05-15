import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import TopBar from '@/components/TopBar';
import ToastContainer from '@/components/Toast';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return (
    <>
      <TopBar userName={user.name} />
      <main className="page">{children}</main>
      <ToastContainer />
    </>
  );
}
