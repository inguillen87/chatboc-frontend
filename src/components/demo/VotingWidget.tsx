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
    <Card className="w-full max-w-md mx-auto shadow-2xl border-primary/20 overflow-hidden relative">
      {voted && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden">
              <div className="w-full h-full absolute animate-pulse bg-primary/5"></div>
          </div>
      )}
      <CardHeader className="pb-2 relative z-10">
        <CardTitle className="flex items-center gap-2 text-lg">
          <BarChart2 className="h-5 w-5 text-primary" />
          Participación Ciudadana
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 relative z-10">
        <h3 className="font-medium text-center text-lg leading-tight text-foreground/90">{question}</h3>

        {!voted ? (
          <div className="grid grid-cols-2 gap-4 pt-2">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                size="lg"
                className="w-full bg-green-600 hover:bg-green-700 text-white shadow-md transition-all"
                onClick={() => handleVote('yes')}
                >
                <Check className="mr-2 h-5 w-5" /> {yesLabel}
                </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                size="lg"
                variant="destructive"
                className="w-full shadow-md transition-all"
                onClick={() => handleVote('no')}
                >
                <X className="mr-2 h-5 w-5" /> {noLabel}
                </Button>
            </motion.div>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", bounce: 0.5 }}
            className="space-y-6 pt-4"
          >
            <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 text-green-600 mb-2">
                    <Check className="w-6 h-6" />
                </div>
                <h4 className="text-xl font-bold text-green-700">¡Voto Registrado!</h4>
            </div>
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
