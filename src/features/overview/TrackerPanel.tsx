import { ArrowDownRight, ArrowUpRight, BarChart3, GitCompare, Minus, Package, TrendingUp } from 'lucide-react'
import { useState } from 'react'
import type { TrackerAnalytics, TrackerRange } from '../../../convex/model/tracker'
import { Card } from '../../components/ui/Card'
import { Segmented } from '../../components/ui/Segmented'
import { PageSpinner } from '../../components/ui/Spinner'
import { cx } from '../../lib/cx'
import { formatCedis } from '../../lib/money'
import styles from './TrackerPanel.module.css'
import { useTracker } from './useOverview'

type TrackerMetric = 'revenue' | 'orders' | 'delivered'

const CHART_WIDTH = 780
const CHART_HEIGHT = 236
const CHART_LEFT = 68
const CHART_RIGHT = 762
const CHART_TOP = 18
const CHART_BOTTOM = 192

function chartTickDate(timestamp: number, range: TrackerRange): string {
  return new Intl.DateTimeFormat('en-GB', {
    ...(range === '7d' ? { weekday: 'short' } : { day: 'numeric', month: 'short' }),
    timeZone: 'Africa/Accra',
  }).format(timestamp)
}

function tooltipDate(timestamp: number): string {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'Africa/Accra',
  }).format(timestamp)
}

function formatAxisCedis(pesewas: number): string {
  const cedis = pesewas / 100
  if (cedis >= 1000) {
    const compact = cedis >= 10_000 ? Math.round(cedis / 1000).toString() : (cedis / 1000).toFixed(1).replace(/\.0$/, '')
    return `₵${compact}k`
  }
  return `₵${Math.round(cedis)}`
}

/** Monotone cubic spline path clamped strictly to the chart area. */
function smoothChartPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return ''
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`
  const n = points.length
  const dx: number[] = []
  const dy: number[] = []
  const slope: number[] = []
  for (let i = 0; i < n - 1; i++) {
    dx.push(points[i + 1].x - points[i].x)
    dy.push(points[i + 1].y - points[i].y)
    slope.push(dx[i] === 0 ? 0 : dy[i] / dx[i])
  }
  const tangents = [slope[0]]
  for (let i = 1; i < n - 1; i++) {
    tangents.push(slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2)
  }
  tangents.push(slope[n - 2])

  for (let i = 0; i < n - 1; i++) {
    if (Math.abs(slope[i]) < 1e-6) {
      tangents[i] = 0
      tangents[i + 1] = 0
    } else {
      const a = tangents[i] / slope[i]
      const b = tangents[i + 1] / slope[i]
      const mag = Math.hypot(a, b)
      if (mag > 3) {
        const scale = 3 / mag
        tangents[i] = scale * a * slope[i]
        tangents[i + 1] = scale * b * slope[i]
      }
    }
  }

  let path = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`
  for (let i = 0; i < n - 1; i++) {
    const p0 = points[i]
    const p1 = points[i + 1]
    const step = dx[i] / 3
    const cp1y = Math.min(CHART_BOTTOM, Math.max(CHART_TOP, p0.y + tangents[i] * step))
    const cp2y = Math.min(CHART_BOTTOM, Math.max(CHART_TOP, p1.y - tangents[i + 1] * step))
    path += ` C ${(p0.x + step).toFixed(2)} ${cp1y.toFixed(2)}, ${(p1.x - step).toFixed(2)} ${cp2y.toFixed(2)}, ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`
  }
  return path
}

function DeltaPill({ delta }: { delta: number | null }) {
  if (delta === null) {
    return (
      <span className={cx(styles.delta, styles.deltaFlat)} title="No activity in prior comparison period">
        <Minus size={12} /> New
      </span>
    )
  }
  if (delta === 0) {
    return (
      <span className={cx(styles.delta, styles.deltaFlat)}>
        <Minus size={12} /> 0%
      </span>
    )
  }
  const positive = delta > 0
  return (
    <span className={cx(styles.delta, positive ? styles.deltaUp : styles.deltaDown)}>
      {positive ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
      {positive ? `+${delta}%` : `${delta}%`}
    </span>
  )
}

function TrackerBody({
  data,
  range,
  metric,
  compare,
  onMetricChange,
}: {
  data: TrackerAnalytics
  range: TrackerRange
  metric: TrackerMetric
  compare: boolean
  onMetricChange: (metric: TrackerMetric) => void
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const { series, totals, deltas, pipeline, paymentMix, topProducts } = data

  const currentValues = series.map((d) =>
    metric === 'revenue' ? d.revenuePesewas : metric === 'orders' ? d.orders : d.deliveredOrders,
  )
  const prevValues = series.map((d) =>
    metric === 'revenue' ? d.prevRevenuePesewas : metric === 'orders' ? d.prevOrders : d.prevDeliveredOrders,
  )

  const maxVal = Math.max(...currentValues, ...(compare ? prevValues : []), 0)
  const scaleMax = maxVal > 0 ? maxVal : 1

  const currentPoints = series.map((day, index) => {
    const x = CHART_LEFT + (index * (CHART_RIGHT - CHART_LEFT)) / Math.max(series.length - 1, 1)
    const y = CHART_BOTTOM - (currentValues[index] / scaleMax) * (CHART_BOTTOM - CHART_TOP)
    return { ...day, value: currentValues[index], prevValue: prevValues[index], x, y }
  })

  const prevPoints = series.map((_, index) => {
    const x = CHART_LEFT + (index * (CHART_RIGHT - CHART_LEFT)) / Math.max(series.length - 1, 1)
    const y = CHART_BOTTOM - (prevValues[index] / scaleMax) * (CHART_BOTTOM - CHART_TOP)
    return { x, y }
  })

  const linePath = smoothChartPath(currentPoints)
  const prevLinePath = smoothChartPath(prevPoints)
  const areaPath = currentPoints.length
    ? `${linePath} L ${currentPoints[currentPoints.length - 1].x.toFixed(2)} ${CHART_BOTTOM} L ${currentPoints[0].x.toFixed(2)} ${CHART_BOTTOM} Z`
    : ''

  const yFractions = metric !== 'revenue' && maxVal === 1 ? [0, 1] : [0, 0.5, 1]
  const tickStep = range === '7d' ? 1 : range === '30d' ? 6 : 18
  const dateTicks = currentPoints.filter((_, index) => index % tickStep === 0 || index === currentPoints.length - 1)

  const activePoint = hoveredIndex !== null ? currentPoints[hoveredIndex] : undefined
  const activePrevPoint = hoveredIndex !== null ? prevPoints[hoveredIndex] : undefined
  const columnWidth =
    currentPoints.length > 1 ? (CHART_RIGHT - CHART_LEFT) / (currentPoints.length - 1) : CHART_RIGHT - CHART_LEFT

  const pipelineStages = [
    { key: 'delivered', label: 'Delivered', tone: 'green', ...pipeline.delivered },
    { key: 'inTransit', label: 'Out for delivery', tone: 'blue', ...pipeline.inTransit },
    { key: 'readyToDispatch', label: 'Ready to pack', tone: 'accent', ...pipeline.readyToDispatch },
    { key: 'awaitingPayment', label: 'Awaiting payment', tone: 'amber', ...pipeline.awaitingPayment },
    { key: 'issues', label: 'Failed / cancelled', tone: 'red', ...pipeline.issues },
  ] as const

  const pipelineTotal = pipelineStages.reduce((sum, s) => sum + s.count, 0)
  const mixTotal = paymentMix.onlineOrders + paymentMix.cashOrders
  const onlineSharePct = mixTotal > 0 ? Math.round((paymentMix.onlineOrders / mixTotal) * 100) : 0
  const maxProductRev = Math.max(...topProducts.map((p) => p.revenuePesewas), 1)

  return (
    <div className={styles.content}>
      {/* 4 KPI Summary Tiles */}
      <div className={styles.kpiGrid} role="group" aria-label={`Summary for the last ${data.days} days`}>
        <button
          type="button"
          className={cx(styles.kpi, styles.kpiButton, metric === 'revenue' && styles.kpiActive)}
          onClick={() => onMetricChange('revenue')}
        >
          <div className={styles.kpiHead}>
            <span>Collected revenue</span>
            <DeltaPill delta={deltas.revenuePct} />
          </div>
          <strong className="num">{formatCedis(totals.revenuePesewas)}</strong>
          <span className={styles.kpiHint}>Gross placed: {formatCedis(totals.grossPesewas)}</span>
        </button>

        <button
          type="button"
          className={cx(styles.kpi, styles.kpiButton, metric === 'orders' && styles.kpiActive)}
          onClick={() => onMetricChange('orders')}
        >
          <div className={styles.kpiHead}>
            <span>Orders placed</span>
            <DeltaPill delta={deltas.ordersPct} />
          </div>
          <strong className="num">{totals.orders}</strong>
          <span className={styles.kpiHint}>{totals.paymentRatePct}% paid or settled</span>
        </button>

        <button
          type="button"
          className={cx(styles.kpi, styles.kpiButton, metric === 'delivered' && styles.kpiActive)}
          onClick={() => onMetricChange('delivered')}
        >
          <div className={styles.kpiHead}>
            <span>Delivered</span>
            <DeltaPill delta={deltas.deliveredPct} />
          </div>
          <strong className="num">{totals.deliveredOrders}</strong>
          <span className={styles.kpiHint}>{totals.fulfilmentRatePct}% fulfilment rate</span>
        </button>

        <div className={styles.kpi}>
          <div className={styles.kpiHead}>
            <span>Avg. order value</span>
            <DeltaPill delta={deltas.avgOrderPct} />
          </div>
          <strong className="num">{formatCedis(totals.avgOrderPesewas)}</strong>
          <span className={styles.kpiHint}>
            {totals.failedOrCancelled > 0 ? `${totals.failedOrCancelled} failed or cancelled` : 'Zero cancellations'}
          </span>
        </div>
      </div>

      {/* Main Chart Surface */}
      <div className={styles.chartSection}>
        <div className={styles.chartMeta}>
          <div className={styles.legend}>
            <span className={styles.legendItem}>
              <i className={styles.swatchPrimary} />
              Current {data.days}d
            </span>
            {compare && (
              <span className={styles.legendItem}>
                <i className={styles.swatchPrev} />
                Prior {data.days}d
              </span>
            )}
          </div>
          <span className={styles.tzNote}>Daily totals · Ghana time (GMT)</span>
        </div>

        {maxVal === 0 ? (
          <div className={styles.chartEmpty}>
            <span className={styles.chartEmptyIcon}>
              <BarChart3 size={19} />
            </span>
            <strong>No {metric === 'revenue' ? 'collected revenue' : metric === 'delivered' ? 'deliveries' : 'orders'} in this window</strong>
            <span>Real customer orders from WhatsApp will plot here automatically as they come in.</span>
          </div>
        ) : (
          <div className={styles.chartWrap} onMouseLeave={() => setHoveredIndex(null)}>
            <svg
              className={styles.chart}
              viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
              role="img"
              aria-label={`${metric} tracker over the last ${data.days} days`}
            >
              <defs>
                <linearGradient id="tracker-area-fill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
                </linearGradient>
              </defs>

              {yFractions.map((fraction) => {
                const y = CHART_TOP + fraction * (CHART_BOTTOM - CHART_TOP)
                const raw = Math.round(maxVal * (1 - fraction))
                const label = metric === 'revenue' ? formatAxisCedis(raw) : String(raw)
                return (
                  <g key={fraction}>
                    <line className={styles.chartGrid} x1={CHART_LEFT} x2={CHART_RIGHT} y1={y} y2={y} />
                    <text className={styles.chartAxis} x={CHART_LEFT - 12} y={y + 4} textAnchor="end">
                      {label}
                    </text>
                  </g>
                )
              })}

              <path d={areaPath} fill="url(#tracker-area-fill)" />
              {compare && <path className={styles.chartPrevLine} d={prevLinePath} />}
              <path className={styles.chartLine} d={linePath} />

              {activePoint && (
                <line className={styles.chartCrosshair} x1={activePoint.x} x2={activePoint.x} y1={CHART_TOP} y2={CHART_BOTTOM} />
              )}

              {compare && activePrevPoint && (
                <circle className={styles.chartPrevPoint} cx={activePrevPoint.x} cy={activePrevPoint.y} r={3.5} />
              )}

              {currentPoints.map((point, index) => {
                const active = hoveredIndex === index
                const showDot = active || range === '7d' || point.value > 0
                const hitX = Math.max(CHART_LEFT, point.x - columnWidth / 2)
                const hitW = Math.min(columnWidth, CHART_RIGHT - hitX)
                return (
                  <g key={point.date}>
                    {active && <circle className={styles.chartHalo} cx={point.x} cy={point.y} r={8.5} />}
                    {showDot && (
                      <circle
                        className={styles.chartPoint}
                        cx={point.x}
                        cy={point.y}
                        r={active ? 4.5 : range === '7d' ? 3.2 : 2.2}
                      />
                    )}
                    <rect
                      className={styles.chartHit}
                      x={hitX}
                      y={CHART_TOP - 8}
                      width={hitW}
                      height={CHART_BOTTOM - CHART_TOP + 16}
                      tabIndex={0}
                      aria-label={`${tooltipDate(point.date)}: ${point.orders} orders, ${formatCedis(point.revenuePesewas)}`}
                      onMouseEnter={() => setHoveredIndex(index)}
                      onFocus={() => setHoveredIndex(index)}
                      onBlur={() => setHoveredIndex(null)}
                    />
                  </g>
                )
              })}

              {dateTicks.map((tick) => (
                <text key={tick.date} className={styles.chartAxis} x={tick.x} y={CHART_HEIGHT - 8} textAnchor="middle">
                  {chartTickDate(tick.date, range)}
                </text>
              ))}
            </svg>

            {activePoint && hoveredIndex !== null && (
              <div
                className={cx(styles.tooltip, hoveredIndex > currentPoints.length * 0.62 && styles.tooltipFlip)}
                style={{ left: `${(activePoint.x / CHART_WIDTH) * 100}%` }}
                role="status"
              >
                <div className={styles.tooltipDate}>{tooltipDate(activePoint.date)}</div>
                <div className={styles.tooltipRow}>
                  <span className={styles.tooltipLabel}>
                    <i className={styles.swatchPrimary} /> Revenue
                  </span>
                  <strong className="num">{formatCedis(activePoint.revenuePesewas)}</strong>
                </div>
                <div className={styles.tooltipRow}>
                  <span className={styles.tooltipLabel}>Orders · Delivered</span>
                  <strong className="num">
                    {activePoint.orders} · {activePoint.deliveredOrders}
                  </strong>
                </div>
                {compare && (
                  <div className={cx(styles.tooltipRow, styles.tooltipPrev)}>
                    <span className={styles.tooltipLabel}>
                      <i className={styles.swatchPrevDot} /> Prior period
                    </span>
                    <span className="num">
                      {metric === 'revenue'
                        ? formatCedis(activePoint.prevRevenuePesewas)
                        : metric === 'delivered'
                          ? `${activePoint.prevDeliveredOrders} delivered`
                          : `${activePoint.prevOrders} orders`}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Lower Analytics Split: Fulfilment Pipeline + Top Products */}
      <div className={styles.breakdown}>
        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <h3>Order pipeline</h3>
            <span className="num">{pipelineTotal} total</span>
          </div>

          {pipelineTotal === 0 ? (
            <p className={styles.panelEmpty}>No placed orders in this timeframe yet.</p>
          ) : (
            <>
              <div className={styles.stackedBar} aria-hidden="true">
                {pipelineStages.map(
                  (stage) =>
                    stage.count > 0 && (
                      <span
                        key={stage.key}
                        data-tone={stage.tone}
                        style={{ width: `${(stage.count / pipelineTotal) * 100}%` }}
                        title={`${stage.label}: ${stage.count}`}
                      />
                    ),
                )}
              </div>

              <ul className={styles.stageList}>
                {pipelineStages.map((stage) => (
                  <li key={stage.key}>
                    <span className={styles.stageName}>
                      <i data-tone={stage.tone} />
                      {stage.label}
                    </span>
                    <span className={cx(styles.stageCount, 'num')}>{stage.count}</span>
                    <span className={cx(styles.stageVal, 'num')}>{formatCedis(stage.pesewas)}</span>
                  </li>
                ))}
              </ul>

              {mixTotal > 0 && (
                <div className={styles.mixBlock}>
                  <div className={styles.mixHead}>
                    <span>Payment mix</span>
                    <span className="num">{onlineSharePct}% MoMo &amp; card</span>
                  </div>
                  <div className={styles.mixBar} aria-hidden="true">
                    <span className={styles.mixOnline} style={{ width: `${onlineSharePct}%` }} />
                    <span className={styles.mixCash} style={{ width: `${100 - onlineSharePct}%` }} />
                  </div>
                  <div className={styles.mixLegend}>
                    <span>
                      <i className={styles.mixDotOnline} /> MoMo / Card: {paymentMix.onlineOrders} (
                      {formatCedis(paymentMix.onlinePesewas)})
                    </span>
                    <span>
                      <i className={styles.mixDotCash} /> Cash: {paymentMix.cashOrders} ({formatCedis(paymentMix.cashPesewas)})
                    </span>
                  </div>
                </div>
              )}
            </>
          )}
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <h3>Top selling items</h3>
            <span>By revenue</span>
          </div>

          {topProducts.length === 0 ? (
            <div className={styles.panelEmptyBox}>
              <Package size={18} />
              <p>Top products will rank here as customers place orders.</p>
            </div>
          ) : (
            <ol className={styles.productList}>
              {topProducts.map((product, index) => (
                <li key={product.name}>
                  <div className={styles.productTop}>
                    <span className={styles.productRank}>{index + 1}</span>
                    <strong className={styles.productName}>{product.name}</strong>
                    <span className={cx(styles.productUnits, 'num')}>{product.unitsSold} sold</span>
                    <span className={cx(styles.productRev, 'num')}>{formatCedis(product.revenuePesewas)}</span>
                  </div>
                  <div className={styles.productTrack} aria-hidden="true">
                    <span style={{ width: `${Math.max((product.revenuePesewas / maxProductRev) * 100, 4)}%` }} />
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      {data.partial && (
        <p className={styles.partialNote}>
          Tracker reflects the latest 5,000 orders in this window.
        </p>
      )}
    </div>
  )
}

export function TrackerPanel() {
  const [range, setRange] = useState<TrackerRange>('30d')
  const [metric, setMetric] = useState<TrackerMetric>('revenue')
  const [compare, setCompare] = useState(true)
  const tracker = useTracker(range)

  return (
    <Card
      title={
        <span className={styles.cardTitle}>
          <TrendingUp size={16} className={styles.titleIcon} />
          Performance tracker
        </span>
      }
      description={`Live revenue, order volume, fulfilment pipeline and product velocity · vs prior ${range === '7d' ? '7 days' : range === '90d' ? '90 days' : '30 days'}.`}
      actions={
        <div className={styles.controls}>
          <button
            type="button"
            className={cx(styles.compareBtn, compare && styles.compareActive)}
            aria-pressed={compare}
            onClick={() => setCompare((c) => !c)}
            title="Overlay previous period for comparison"
          >
            <GitCompare size={14} />
            <span>vs prev</span>
          </button>
          <Segmented
            label="Tracker metric"
            options={[
              { value: 'revenue', label: 'Revenue' },
              { value: 'orders', label: 'Orders' },
              { value: 'delivered', label: 'Delivered' },
            ]}
            value={metric}
            onChange={setMetric}
          />
          <Segmented
            label="Tracker range"
            options={[
              { value: '7d', label: '7D' },
              { value: '30d', label: '30D' },
              { value: '90d', label: '90D' },
            ]}
            value={range}
            onChange={setRange}
          />
        </div>
      }
      flush
    >
      {tracker === undefined ? (
        <PageSpinner />
      ) : tracker === null ? null : (
        <TrackerBody data={tracker} range={range} metric={metric} compare={compare} onMetricChange={setMetric} />
      )}
    </Card>
  )
}
