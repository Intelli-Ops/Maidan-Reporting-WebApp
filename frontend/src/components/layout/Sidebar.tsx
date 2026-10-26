import { NavLink } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { buildNavSections } from '@/components/layout/navConfig';
import { cn } from '@/lib/utils';
import maidanLogo from '@/assets/maidan-logo.png';

export function Sidebar() {
  const { user } = useAuth();
  if (!user) return null;

  const sections = buildNavSections(user);

  return (
    <aside
      className="relative hidden w-[240px] shrink-0 flex-col overflow-hidden px-4 py-6 lg:flex"
      style={{
        // Same "night" family as the login brand panel (NightScene.tsx), just
        // lightened a few stops — the login version reads well full-bleed,
        // but the sidebar is a narrow persistent strip and read too close to
        // black at those same stops.
        background:
          'radial-gradient(circle at 20% 0%, rgba(55,138,221,0.34), transparent 48%), ' +
          'linear-gradient(180deg, #0B2A42 0%, #103B3A 45%, #164A2E 85%, #1C5A2A 100%)',
      }}
    >
      <div className="relative z-10 flex items-center px-2">
        <span className="inline-flex items-center rounded-[10px] border border-white/70 bg-gradient-to-br from-[#F8FAF9] to-[#E7F2ED] px-4 py-2">
          <img src={maidanLogo} alt="Maidan" className="block h-[18px] w-auto" />
        </span>
      </div>
      <nav className="relative z-10 mt-8 flex flex-col gap-6">
        {sections.map((section) => (
          <div key={section.label}>
            <p className="px-2 text-[10px] font-semibold uppercase tracking-wider text-white/40">{section.label}</p>
            <div className="mt-1.5 flex flex-col gap-0.5">
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    cn(
                      'relative rounded-md px-2.5 py-2 text-sm transition-colors duration-200 ease-[var(--ease-maidan)]',
                      isActive ? 'bg-white/10 font-medium text-white' : 'text-white/60 hover:bg-white/5 hover:text-white/90'
                    )
                  }
                >
                  {({ isActive }) => (
                    <span className="flex items-center gap-2.5">
                      <span
                        className={cn(
                          'h-1.5 w-1.5 shrink-0 rounded-full transition-colors duration-200',
                          isActive ? 'bg-mint shadow-[0_0_8px_1px_rgba(93,202,165,0.7)]' : 'bg-white/20'
                        )}
                      />
                      {item.label}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
