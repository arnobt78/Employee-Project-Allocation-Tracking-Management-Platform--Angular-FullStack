import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { ProjectComponent } from './project.component';
import { MasterService } from '../../service/master.service';
import { kpiCards, warmPortfolioCaches } from '@/app/testing/portfolio-fixture';

describe('ProjectComponent', () => {
  let component: ProjectComponent;
  let fixture: ComponentFixture<ProjectComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectComponent],
      providers: [provideHttpClient(), provideRouter([])],
    }).compileComponents();
  });

  it('should create', () => {
    fixture = TestBed.createComponent(ProjectComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('counts every project in the Projects KPI and buckets active ones by status', () => {
    warmPortfolioCaches(TestBed.inject(MasterService));
    fixture = TestBed.createComponent(ProjectComponent);
    fixture.detectChanges();
    const cards = kpiCards(fixture.nativeElement as HTMLElement);

    expect(cards['Projects']).toBe('5 | 4 Active · 1 Archived');
    expect(cards['In Flight']).toBe('2 | Approved or in review');
    expect(cards['Planning']).toBe('1 | Draft or planning');
    expect(cards['On Hold']).toBe('1 | Paused projects');
    expect(cards['Archived']).toMatch(/^1 \|/);
  });
});
