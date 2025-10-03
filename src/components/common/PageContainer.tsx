import React from 'react';

interface PageContainerProps {
  title: string;
  icon?: string; // FontAwesome class e.g., 'fas fa-mobile-alt'
  children: React.ReactNode;
}

const PageContainer: React.FC<PageContainerProps> = ({ title, icon, children }) => {
  return (
    <div className="bg-slate-800 p-6 rounded-lg shadow-xl text-slate-100">
      <h2 className="text-2xl font-semibold text-cyan-400 mb-6 border-b pb-3">
        {icon && <i className={`${icon} text-blue-400 mr-2`}></i>}
        {title}
      </h2>
      {children}
    </div>
  );
};

export default PageContainer;
