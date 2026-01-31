import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Lightbulb, AlertTriangle, CheckCircle } from 'lucide-react';
import { analyticsService } from '../../services/analyticsService';

interface Props {
  tenantId: number;
}

const InsightsDashboard: React.FC<Props> = ({ tenantId }) => {
  const [insights, setInsights] = useState<any[]>([]);

  useEffect(() => {
    analyticsService.getInsights(tenantId).then(setInsights);
  }, [tenantId]);

  if (!insights.length) return null;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {insights.map((insight, idx) => (
        <Card key={idx} className="border-l-4 border-l-yellow-400">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
                {insight.severity === 'high' ? <AlertTriangle className="text-red-500" /> :
                 insight.severity === 'med' ? <Lightbulb className="text-yellow-500" /> :
                 <CheckCircle className="text-green-500" />}
                <div>
                    <p className="font-medium">{insight.text}</p>
                    <p className="text-xs text-muted-foreground mt-2">Confianza: {(insight.confidence * 100).toFixed(0)}%</p>
                </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default InsightsDashboard;
