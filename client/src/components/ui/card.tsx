import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}

export const Card: React.FC<CardProps> = ({ className, ...props }) => {
  return (
    <div 
      className={`bg-white border rounded-lg shadow-sm overflow-hidden ${className || ''}`} 
      {...props} 
    />
  );
};

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}

export const CardHeader: React.FC<CardHeaderProps> = ({ className, ...props }) => {
  return <div className={`p-6 ${className || ''}`} {...props} />;
};

export interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {}

export const CardTitle: React.FC<CardTitleProps> = ({ className, ...props }) => {
  return (
    <h3 
      className={`text-lg font-semibold leading-none tracking-tight ${className || ''}`} 
      {...props} 
    />
  );
};

export interface CardDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {}

export const CardDescription: React.FC<CardDescriptionProps> = ({ className, ...props }) => {
  return (
    <p 
      className={`text-sm text-gray-500 mt-2 ${className || ''}`} 
      {...props} 
    />
  );
};

export interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {}

export const CardContent: React.FC<CardContentProps> = ({ className, ...props }) => {
  return <div className={`p-6 pt-0 ${className || ''}`} {...props} />;
};

export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {}

export const CardFooter: React.FC<CardFooterProps> = ({ className, ...props }) => {
  return (
    <div 
      className={`p-6 flex items-center ${className || ''}`} 
      {...props} 
    />
  );
};