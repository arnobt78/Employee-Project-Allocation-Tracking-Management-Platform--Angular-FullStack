import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  ChartConfiguration,
  DoughnutController,
  Legend,
  LinearScale,
  Tooltip,
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';

Chart.register(
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  DoughnutController,
  Legend,
  LinearScale,
  Tooltip,
  ChartDataLabels
);

export interface DashboardChartSlice {
  label: string;
  value: number;
  color: string;
}

@Component({
  selector: 'app-dashboard-chart',
  standalone: true,
  template: `
    <div
      class="chart-scroll eh-scrollbar w-full"
      data-testid="dashboard-chart-scroll"
    >
      <div
        class="chart-canvas-wrap relative h-56 w-full"
        [class.chart-canvas-wrap--bar]="type === 'bar'"
        data-testid="dashboard-chart-canvas-wrap"
      >
        <canvas #canvas [attr.aria-label]="title"></canvas>
      </div>
    </div>
    @if (type === 'doughnut' && slices.length) {
      <ul
        class="mt-3 flex flex-wrap gap-x-4 gap-y-2"
        data-testid="dashboard-chart-legend"
      >
        @for (slice of slices; track slice.label) {
          <li class="inline-flex items-center gap-2 text-xs text-white/80">
            <span
              class="h-2.5 w-2.5 shrink-0 rounded-sm"
              [style.backgroundColor]="slice.color"
              aria-hidden="true"
            ></span>
            <span>{{ slice.label }} · {{ slice.value }}</span>
          </li>
        }
      </ul>
    }
  `,
  styles: [
    `
      .chart-scroll {
        overflow-x: visible;
        overscroll-behavior-x: contain;
        -webkit-overflow-scrolling: touch;
      }
      @media (max-width: 639px) {
        .chart-scroll {
          overflow-x: auto;
        }
        .chart-canvas-wrap--bar {
          min-width: 26rem;
        }
      }
    `,
  ],
})
export class DashboardChartComponent
  implements AfterViewInit, OnChanges, OnDestroy
{
  @ViewChild('canvas', { static: true })
  canvas!: ElementRef<HTMLCanvasElement>;

  @Input({ required: true }) title = '';
  @Input() type: 'doughnut' | 'bar' = 'doughnut';
  @Input() slices: DashboardChartSlice[] = [];

  private chart: Chart | null = null;
  private viewReady = false;

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.render();
  }

  ngOnChanges(_changes: SimpleChanges): void {
    if (this.viewReady) {
      this.render();
    }
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
    this.chart = null;
  }

  private render(): void {
    const labels = this.slices.map((s) => s.label);
    const data = this.slices.map((s) => s.value);
    const colors = this.slices.map((s) => s.color);
    const maxValue = data.reduce((m, v) => Math.max(m, v), 0);

    const config: ChartConfiguration = {
      type: this.type,
      data: {
        labels,
        datasets: [
          {
            label: this.title,
            data,
            backgroundColor: colors,
            borderColor: 'rgba(15, 23, 42, 0.65)',
            borderWidth: this.type === 'doughnut' ? 2 : 0,
            borderRadius: this.type === 'bar' ? 8 : 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        clip: false,
        layout: {
          padding: {
            top: this.type === 'bar' ? 28 : 8,
            bottom: 4,
            left: 4,
            right: 4,
          },
        },
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            titleColor: '#fff',
            bodyColor: 'rgba(255,255,255,0.85)',
          },
          datalabels: {
            color: '#fff',
            font: { weight: 'bold', size: 11 },
            formatter: (value: number) => (value > 0 ? String(value) : ''),
            anchor: this.type === 'bar' ? 'end' : 'center',
            align: this.type === 'bar' ? 'end' : 'center',
            offset: this.type === 'bar' ? 2 : 0,
            clamp: false,
            clip: false,
            display: (ctx) => {
              const v = Number(ctx.dataset.data[ctx.dataIndex] ?? 0);
              return v > 0;
            },
          },
        },
        scales:
          this.type === 'bar'
            ? {
                x: {
                  ticks: {
                    color: 'rgba(255,255,255,0.7)',
                    maxRotation: 0,
                    autoSkip: false,
                    font: { size: 11 },
                  },
                  grid: { color: 'rgba(255,255,255,0.06)' },
                },
                y: {
                  beginAtZero: true,
                  suggestedMax: maxValue > 0 ? maxValue + 1 : 1,
                  ticks: { color: 'rgba(255,255,255,0.55)', precision: 0 },
                  grid: { color: 'rgba(255,255,255,0.06)' },
                },
              }
            : undefined,
      },
    };

    if (this.chart) {
      this.chart.destroy();
    }
    this.chart = new Chart(this.canvas.nativeElement, config);
  }
}
