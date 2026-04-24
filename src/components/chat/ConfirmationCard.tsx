import React, { useMemo } from "react";
import {
  Boton,
  ConfirmationCardData,
  ConfirmationCardField,
  ConfirmationCardItem,
  SendPayload,
} from "@/types/chat";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import ChatButtons from "./ChatButtons";

interface ConfirmationCardProps {
  card: ConfirmationCardData;
  buttons?: Boton[];
  onButtonClick?: (payload: SendPayload) => void;
  onInternalAction?: (action: string) => void;
}

const normalizeLabel = (value?: string | null) => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
};

const getDisplayValue = (value: unknown): string | number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return null;
};

const deriveFallbackFields = (card: ConfirmationCardData): ConfirmationCardField[] => {
  const fieldCandidates: Array<[string, unknown]> = [
    ["category", card.category],
    ["location", card.location],
    ["detail", card.detail],
    ["contact", card.contact],
    ["total", card.total],
  ];

  return fieldCandidates
    .map(([label, value]) => {
      const displayValue = getDisplayValue(value);
      const displayLabel = normalizeLabel(label);
      if (!displayValue || !displayLabel) return null;
      return { label: displayLabel, value: displayValue } satisfies ConfirmationCardField;
    })
    .filter((item): item is ConfirmationCardField => Boolean(item));
};

const ConfirmationCard: React.FC<ConfirmationCardProps> = ({
  card,
  buttons = [],
  onButtonClick,
  onInternalAction,
}) => {
  const fields = useMemo(() => {
    if (Array.isArray(card.fields) && card.fields.length > 0) {
      return card.fields.filter(
        (field): field is ConfirmationCardField =>
          Boolean(field?.label) && getDisplayValue(field?.value) !== null,
      );
    }
    return deriveFallbackFields(card);
  }, [card]);

  const items = useMemo(
    () =>
      Array.isArray(card.items)
        ? card.items.filter(
            (item): item is ConfirmationCardItem =>
              Boolean(item) &&
              Boolean(
                getDisplayValue(item.label) ||
                  getDisplayValue(item.description) ||
                  getDisplayValue(item.quantity) ||
                  getDisplayValue(item.amount),
              ),
          )
        : [],
    [card.items],
  );

  const channelBadges = useMemo(
    () =>
      (card.preferred_handoff_channels || [])
        .map((channel) => normalizeLabel(channel))
        .filter((channel): channel is string => Boolean(channel)),
    [card.preferred_handoff_channels],
  );

  return (
    <Card className="border-primary/15 bg-gradient-to-br from-background to-primary/[0.04] shadow-sm">
      <CardContent className="space-y-4 p-4">
        <div className="space-y-2">
          {card.flow_type ? (
            <Badge variant="secondary" className="capitalize">
              {normalizeLabel(card.flow_type)}
            </Badge>
          ) : null}
          {card.title ? (
            <div className="text-sm font-semibold text-foreground">{card.title}</div>
          ) : null}
          {card.subtitle ? (
            <div className="text-xs text-muted-foreground">{card.subtitle}</div>
          ) : null}
          {card.summary_text ? (
            <p className="text-sm leading-relaxed text-foreground">{card.summary_text}</p>
          ) : null}
          {card.summary_voice ? card.summary_voice !== card.summary_text : false ? (
            <p className="rounded-lg border border-dashed border-border bg-muted/40 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
              {card.summary_voice}
            </p>
          ) : null}
        </div>

        {fields.length > 0 ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {fields.map((field, index) => (
              <div key={`${field.label}_${index}`} className="rounded-lg border bg-background/80 px-3 py-2">
                <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {field.label}
                </div>
                <div className="mt-1 text-sm text-foreground">{field.value}</div>
              </div>
            ))}
          </div>
        ) : null}

        {items.length > 0 ? (
          <div className="space-y-2">
            {items.map((item, index) => (
              <div
                key={`${item.label || item.description || 'item'}_${index}`}
                className={cn(
                  "rounded-lg border bg-background/80 px-3 py-2",
                  index === 0 ? "border-primary/20" : "border-border",
                )}
              >
                {item.label ? (
                  <div className="text-sm font-medium text-foreground">{item.label}</div>
                ) : null}
                {item.description ? (
                  <div className="text-xs text-muted-foreground">{item.description}</div>
                ) : null}
                {item.quantity || item.amount ? (
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {item.quantity ? <span>{item.quantity}</span> : null}
                    {item.amount ? <span>{item.amount}</span> : null}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        {channelBadges.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {channelBadges.map((channel, index) => (
              <Badge key={`${channel}_${index}`} variant="outline" className="capitalize">
                {channel}
              </Badge>
            ))}
          </div>
        ) : null}

        {buttons.length > 0 && onButtonClick ? (
          <ChatButtons
            botones={buttons}
            onButtonClick={onButtonClick}
            onInternalAction={onInternalAction}
          />
        ) : null}
      </CardContent>
    </Card>
  );
};

export default ConfirmationCard;
