import gitIcon from '../../assets/icons/git-icon.png';

export function GitIcon({ className }: { className?: string }) {
  return (
    <img
      src={gitIcon}
      alt="Git"
      className={className}
      style={{ objectFit: 'contain' }}
    />
  );
}
