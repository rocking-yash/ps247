import { notFound } from 'next/navigation';
import Simulator from '@/components/simulator/Simulator';
import { getReplaySource } from '@/lib/replay';

export const metadata = {
  title: 'Simulator — Counter-Drone Trainer',
};

// /simulator runs a new session. /simulator?replay=<session id> reruns a
// recorded one from its stored seed, level and lighting.
export default async function SimulatorPage({ searchParams }) {
  const { replay } = await searchParams;
  if (!replay) return <Simulator />;

  const source = await getReplaySource(replay);
  if (!source) notFound();
  return <Simulator replay={source} />;
}
