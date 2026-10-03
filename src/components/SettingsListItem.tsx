import React from 'react';
import { ChevronRight } from 'lucide-react';

interface SettingsListItemProps {
  icon: React.ReactNode;
  label: string;
  description?: string;
  type: 'toggle' | 'navigation';
  value?: boolean;
  onChange?: (value: boolean) => void;
  onClick?: () => void;
  colorClass?: string;
}

const SettingsListItem: React.FC<SettingsListItemProps> = ({
  icon,
  label,
  description,
  type,
  value,
  onChange,
  onClick,
  colorClass = 'text-muted-foreground'
}) => {
  return (
    <div 
      className="flex items-center justify-between p-4 bg-background dark:bg-card rounded-sm  hover:bg-background dark:hover:bg-card transition-colors cursor-pointer"
      onClick={type === 'navigation' ? onClick : undefined}
    >
      <div className="flex items-center space-x-3">
        <div className={`${colorClass}`}>
          {icon}
        </div>
        <span className="text-foreground dark:text-muted-foreground font-medium">{label}</span>
        {description && <div className="text-muted-foreground dark:text-muted-foreground text-xs mt-0.5">{description}</div>}
      </div>
      
      {type === 'toggle' ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onChange?.(!value);
          }}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
            value ? 'bg-primary' : 'bg-secondary dark:bg-card'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
              value ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      ) : (
        <ChevronRight className="w-5 h-5 text-muted-foreground dark:text-muted-foreground" />
      )}
    </div>
  );
};

export default SettingsListItem; 