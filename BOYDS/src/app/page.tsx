import { redirect } from 'next/navigation';

/**
 * The root path belongs to the public marketing website.
 *
 * Phase 10 replaces this redirect with the real home page. Until then it points
 * at the placeholder so the three route groups are wired and verifiable.
 */
export default function RootPage() {
  redirect('/home');
}
