export async function getIdentityCoverageV1() {
  return {
    alert_count: 1,
    alerts: [{ channel: 'WhatsApp', coverage_pct: 50, target_pct: 80, gap_pct: 30 }],
  };
}
