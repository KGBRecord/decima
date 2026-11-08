import logo from '@/assets/ephemera/logo.svg';

/** The Ephemera mark: a disc dissolving into fading dots. Same SVG the generator writes. */
export function EphemeraLogo({ size = 28, className }: { size?: number; className?: string }) {
  return <img src={logo} width={size} height={size} alt="Ephemera" className={className} />;
}
