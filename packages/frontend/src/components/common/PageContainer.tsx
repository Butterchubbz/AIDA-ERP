import React from 'react';
import genericDeviceLogo from '../../assets/logos/generic-device.svg';
import genericComponentLogo from '../../assets/logos/generic-component.svg';
import genericForecastLogo from '../../assets/logos/generic-forecast.svg';

interface PageContainerProps {
  title: string;
  icon?: string; // FontAwesome class e.g., 'fas fa-mobile-alt'
  subtitle?: string;
  actions?: React.ReactNode;
  variant?: 'card' | 'plain';
  children: React.ReactNode;
}

const categoryLogoMap: Record<string, { src: string; alt: string }> = {
  'fas fa-mobile-alt': { src: genericDeviceLogo, alt: 'Device logo' },
  'fas fa-microchip': { src: genericComponentLogo, alt: 'Component logo' },
  'fas fa-chart-line': { src: genericForecastLogo, alt: 'Forecast logo' },
};

const PageContainer: React.FC<PageContainerProps> = ({
  title,
  icon,
  subtitle,
  actions,
  variant = 'card',
  children,
}) => {
  const categoryLogo = icon ? categoryLogoMap[icon] : undefined;
  const containerClassName = variant === 'card'
    ? 'bg-slate-800 p-6 rounded-lg shadow-xl text-slate-100'
    : 'text-slate-100';

  return (
    <div className={containerClassName}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b pb-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-cyan-400">
            {categoryLogo ? (
              <img src={categoryLogo.src} alt={categoryLogo.alt} className="w-7 h-7 object-contain" />
            ) : (
              icon && <i className={`${icon} text-blue-400`}></i>
            )}
            {title}
          </h1>
          {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
      </div>
      {children}
    </div>
  );
};

export default PageContainer;
