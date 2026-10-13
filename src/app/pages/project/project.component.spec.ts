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

    expect(cards['Projects']).toBe('8 | 7 Active · 1 Archived');
    expect(cards['In Flight']).toBe('1 | Approved, in delivery');
    expect(cards['Planning']).toBe('3 | Draft, in review or rejected');
    expect(cards['On Hold']).toBe('1 | Paused projects');
    expect(cards['Closed']).toBe('2 | 1 Completed · 1 Cancelled');
  });
});
