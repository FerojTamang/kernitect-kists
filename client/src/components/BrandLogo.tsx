import darkLogo from '../assets/branding/kernitect-logo-on-dark.png';
import lightLogo from '../assets/branding/kernitect-logo-on-light.png';

export function BrandLogo({
  variant = 'dark',
}: {
  variant?: 'dark' | 'light';
}) {
  return (
    <img
      className="brand-logo"
      src={variant === 'dark' ? darkLogo : lightLogo}
      alt="Kernitect"
    />
  );
}
