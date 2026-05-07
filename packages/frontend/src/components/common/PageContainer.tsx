import React from 'react';
import genericDeviceLogo from '../../assets/logos/generic-device.svg';
import genericComponentLogo from '../../assets/logos/generic-component.svg';
import genericForecastLogo from '../../assets/logos/generic-forecast.svg';

interface PageContainerProps {
  title: string;
  icon?: string; // FontAwesome class e.g., 'fas fa-mobile-alt'
  children: React.ReactNode;
}

const categoryLogoMap: Record<string, { src: string; alt: string }> = {
  'fas fa-mobile-alt': { src: genericDeviceLogo, alt: 'Device logo' },
  'fas fa-microchip': { src: genericComponentLogo, alt: 'Component logo' },
  'fas fa-chart-line': { src: genericForecastLogo, alt: 'Forecast logo' },
};

const PageContainer: React.FC<PageContainerProps> = ({ title, icon, children }) => {
  const categoryLogo = icon ? categoryLogoMap[icon] : undefined;

  return (
    <div className="bg-slate-800 p-6 rounded-lg shadow-xl text-slate-100">
      <h2 className="text-2xl font-semibold text-cyan-400 mb-6 border-b pb-3 flex items-center gap-2">
        {categoryLogo ? (
          <img src={categoryLogo.src} alt={categoryLogo.alt} className="w-7 h-7 object-contain" />
        ) : (
          icon && <i className={`${icon} text-blue-400 mr-2`}></i>
        )}
        {title}
      </h2>
      {children}
    </div>
  );
};

export default PageContainer;
