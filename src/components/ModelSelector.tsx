'use client';

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Check, ChevronDown, Bot, BrainCircuit } from "lucide-react";
import { useState } from 'react';
import { ALL_AI_MODELS, DEEPSEEK_MODELS, GOOGLE_MODELS, AIProvider, AIModelOption } from '@/services/ai-provider';

interface ModelSelectorProps {
  selectedProvider: AIProvider;
  selectedModel: string;
  onSelect: (provider: AIProvider, modelId: string) => void;
}

export default function ModelSelector({ selectedProvider, selectedModel, onSelect }: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const currentModel = ALL_AI_MODELS.find(model => model.id === selectedModel) || {
    id: '',
    name: 'Select Model',
    provider: selectedProvider,
    description: '',
    isNew: false,
    isHot: false
  };

  const handleSelectModel = (provider: AIProvider, modelId: string) => {
    onSelect(provider, modelId);
    setIsOpen(false);
  };

  const renderModelItem = (model: AIModelOption) => (
    <DropdownMenuItem
      key={model.id}
      onClick={() => handleSelectModel(model.provider, model.id)}
      className="cursor-pointer"
    >
      <div className="flex items-center justify-between w-full">
        <div className="flex flex-col items-start">
          <div className="flex items-center space-x-2">
            <span className="font-medium">{model.name}</span>
            {model.isNew && (
              <Badge variant="outline" className="text-xs text-blue-700 border-blue-200">NEW</Badge>
            )}
            {model.isHot && (
              <Badge variant="destructive" className="text-xs">HOT</Badge>
            )}
          </div>
          {model.description && (
            <p className="text-xs text-muted-foreground">{model.description}</p>
          )}
        </div>
        {selectedModel === model.id && (
          <Check className="h-4 w-4 ml-2 text-primary" />
        )}
      </div>
    </DropdownMenuItem>
  );

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="flex items-center space-x-2">
          {currentModel.provider === 'google' ? (
            <Bot className="w-4 h-4 text-blue-500" />
          ) : (
            <BrainCircuit className="w-4 h-4 text-purple-500" />
          )}
          <span>{currentModel.name}</span>
          {currentModel.isNew && (
            <Badge variant="outline" className="text-xs text-blue-700 border-blue-200">NEW</Badge>
          )}
          {currentModel.isHot && (
            <Badge variant="destructive" className="text-xs">HOT</Badge>
          )}
          <ChevronDown className="h-4 w-4 opacity-50 ml-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-72 p-0" align="end">
        <Tabs defaultValue={selectedProvider} className="w-full">
          <TabsList className="grid w-full grid-cols-2 rounded-none">
            <TabsTrigger value="google">Google Gemini</TabsTrigger>
            <TabsTrigger value="deepseek">DeepSeek</TabsTrigger>
          </TabsList>
          <TabsContent value="google" className="max-h-60 overflow-y-auto m-0">
            {GOOGLE_MODELS.map(renderModelItem)}
          </TabsContent>
          <TabsContent value="deepseek" className="max-h-60 overflow-y-auto m-0">
            {DEEPSEEK_MODELS.map(renderModelItem)}
          </TabsContent>
        </Tabs>
      </DropdownMenuContent>
    </DropdownMenu>
  );
} 