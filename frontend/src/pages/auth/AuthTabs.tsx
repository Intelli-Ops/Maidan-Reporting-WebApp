import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

export function AuthTabs({ active }: { active: 'signin' | 'signup' }) {
  return (
    <div className="mb-7 flex rounded-[10px] bg-surface-muted p-1">
      <Link
        to="/login"
        className={cn(
          'flex-1 rounded-[7px] py-2.5 text-center text-[13.5px] font-medium transition-[background-color,color,box-shadow] duration-150',
          active === 'signin' ? 'bg-surface text-ink shadow-[0_1px_4px_rgba(0,0,0,0.08)]' : 'text-ink-muted'
        )}
      >
        Sign in
      </Link>
      <Link
        to="/register"
        className={cn(
          'flex-1 rounded-[7px] py-2.5 text-center text-[13.5px] font-medium transition-[background-color,color,box-shadow] duration-150',
          active === 'signup' ? 'bg-surface text-ink shadow-[0_1px_4px_rgba(0,0,0,0.08)]' : 'text-ink-muted'
        )}
      >
        Sign up
      </Link>
    </div>
  );
}
