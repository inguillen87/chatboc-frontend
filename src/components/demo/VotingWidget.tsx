import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, X, BarChart2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface VotingWidgetProps {
  question?: string;
  yesLabel?: string;
  noLabel?: string;
  initialYes?: number;
  initialNo?: number;
}

export const VotingWidget: React.FC<VotingWidgetProps> = ({
  question = "¿Está de acuerdo con la nueva plaza central?",
  yesLabel = "Sí, me gusta",
  noLabel = "No, prefiero otra cosa",
  initialYes = 65,
  initialNo = 35
}) => {
  const [voted, setVoted] = useState<'yes' | 'no' | null>(null);
  const [stats, setStats] = useState({ yes: initialYes, no: initialNo });

  const total = stats.yes + stats.no;
  const yesPercent = Math.round((stats.yes / total) * 100);
  const noPercent = 100 - yesPercent;

  const handleVote = (vote: 'yes' | 'no') => {
    if (voted) return;
    setVoted(vote);
    // Simulate real-time update
    setStats(prev => ({
      ...prev,
      [vote]: prev[vote] + 1
    }));
  };

  return (
    <Card className="w-full max-w-md mx-auto shadow-lg border-primary/20">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <BarChart2 className="h-5 w-5 text-primary" />
          Participación Ciudadana
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <h3 className="font-medium text-center text-lg leading-tight">{question}</h3>

        {!voted ? (
          <div className="grid grid-cols-2 gap-4 pt-2">
            <Button
              size="lg"
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={() => handleVote('yes')}
            >
              <Check className="mr-2 h-5 w-5" /> {yesLabel}
            </Button>
            <Button
              size="lg"
              variant="destructive"
              onClick={() => handleVote('no')}
            >
              <X className="mr-2 h-5 w-5" /> {noLabel}
            </Button>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4 pt-2"
          >
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="font-medium text-green-700">{yesLabel}</span>
                <span className="font-bold">{yesPercent}%</span>
              </div>
              <Progress value={yesPercent} className="h-2 bg-green-100 [&>div]:bg-green-600" />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="font-medium text-red-700">{noLabel}</span>
                <span className="font-bold">{noPercent}%</span>
              </div>
              <Progress value={noPercent} className="h-2 bg-red-100 [&>div]:bg-red-600" />
            </div>

            <p className="text-center text-sm text-muted-foreground pt-2">
              ¡Gracias por tu voto! Los resultados se actualizan en tiempo real.
            </p>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
};
