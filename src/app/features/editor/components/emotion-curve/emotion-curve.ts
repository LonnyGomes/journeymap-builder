import { Component, input, computed, ChangeDetectionStrategy } from '@angular/core';
import { JourneyPhase, getEmotionLevel, getEmotionLabel } from '../../../../models/journey-map.model';

interface CurvePoint {
  x: number;
  y: number;
  emoji: string;
  label: string;
  level: number;
}

@Component({
  selector: 'app-emotion-curve',
  templateUrl: './emotion-curve.html',
  styleUrl: './emotion-curve.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmotionCurve {
  readonly phases = input.required<JourneyPhase[]>();
  readonly columnWidth = input<number>(220);
  readonly curveWidth = input<number | null>(null);
  readonly phaseCenters = input<number[] | null>(null);

  private readonly SVG_PADDING_TOP = 18;
  private readonly SVG_PADDING_BOTTOM = 18;

  protected readonly svgWidth = computed(() => {
    const measuredWidth = this.curveWidth();
    if (measuredWidth !== null && measuredWidth > 0) {
      return measuredWidth;
    }
    return this.phases().length * this.columnWidth();
  });

  protected readonly svgHeight = 100;

  protected readonly points = computed<CurvePoint[]>(() => {
    const phases = this.phases();
    const colW = this.columnWidth();
    const centers = this.phaseCenters();
    const usableHeight = this.svgHeight - this.SVG_PADDING_TOP - this.SVG_PADDING_BOTTOM;
    const result: CurvePoint[] = [];

    for (let i = 0; i < phases.length; i++) {
      const phase = phases[i];
      const level = getEmotionLevel(phase.emotion);
      if (level === null) continue;

      result.push({
        x: centers?.[i] ?? i * colW + colW / 2,
        y: this.SVG_PADDING_TOP + usableHeight - (level / 9) * usableHeight,
        emoji: phase.emotion as string,
        label: getEmotionLabel(phase.emotion),
        level,
      });
    }

    return result;
  });

  protected readonly curvePath = computed(() => {
    const pts = this.points();
    if (pts.length < 2) return '';

    let d = `M ${pts[0].x} ${pts[0].y}`;

    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1];
      const curr = pts[i];
      const cpx1 = prev.x + (curr.x - prev.x) * 0.4;
      const cpx2 = curr.x - (curr.x - prev.x) * 0.4;
      d += ` C ${cpx1} ${prev.y}, ${cpx2} ${curr.y}, ${curr.x} ${curr.y}`;
    }

    return d;
  });

  protected readonly areaPath = computed(() => {
    const pts = this.points();
    if (pts.length < 2) return '';

    const curve = this.curvePath();
    const lastPt = pts[pts.length - 1];
    const firstPt = pts[0];

    return `${curve} L ${lastPt.x} ${this.svgHeight} L ${firstPt.x} ${this.svgHeight} Z`;
  });

  protected readonly hasEnoughPoints = computed(() => this.points().length >= 2);

  protected readonly gradientId = 'emotion-curve-gradient';
  protected readonly areaGradientId = 'emotion-area-gradient';

  protected getPointColor(level: number): string {
    if (level >= 7) return 'var(--emotion-positive)';
    if (level >= 4) return 'var(--emotion-neutral)';
    return 'var(--emotion-negative)';
  }

  protected readonly yAxisLabels = [
    { label: 'Delighted', y: 0 },
    { label: 'Neutral', y: 0.5 },
    { label: 'Frustrated', y: 1 },
  ];

  protected getYAxisY(fraction: number): number {
    return this.SVG_PADDING_TOP + fraction * (this.svgHeight - this.SVG_PADDING_TOP - this.SVG_PADDING_BOTTOM);
  }
}
