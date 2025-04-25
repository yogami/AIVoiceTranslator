import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { getLanguageName } from '@/lib/openai';

interface Language {
  code: string;
  name: string;
}

interface LanguageSelectorProps {
  languages: Language[];
  selectedLanguage: string;
  onChange: (language: string) => void;
  label?: string;
  className?: string;
  disabled?: boolean;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  languages,
  selectedLanguage,
  onChange,
  label = 'Select language',
  className = '',
  disabled = false
}) => {
  return (
    <div className={className}>
      {label && (
        <div className="flex items-center justify-between mb-2">
          <Label className="text-sm font-medium text-gray-700">{label}</Label>
        </div>
      )}
      
      <Select
        value={selectedLanguage}
        onValueChange={onChange}
        disabled={disabled}
      >
        <SelectTrigger className="w-full p-2 bg-gray-50">
          <SelectValue placeholder="Select a language" />
        </SelectTrigger>
        <SelectContent>
          {languages.map((language) => (
            <SelectItem key={language.code} value={language.code}>
              {language.name || getLanguageName(language.code)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default LanguageSelector;
