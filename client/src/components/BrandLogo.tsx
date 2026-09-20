import darkLogo from '../assets/branding/kernitect-logo-on-dark.png';
import lightLogo from '../assets/branding/kernitect-logo-on-light.png';
import transparentWhiteLogo from '../assets/branding/kernitect-logo-transparent-white.png';

export function BrandLogo({
  variant = 'dark',
}: {
  variant?: 'dark' | 'light' | 'transparent-white';
}) {
  return (
    <img
      className="brand-logo"
      src={variant === 'transparent-white' ? transparentWhiteLogo : variant === 'dark' ? darkLogo : lightLogo}
      alt="Kernitect"
    />
  );
}
