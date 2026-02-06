import {
  Component,
  EnvironmentInjector,
  inject,
  ViewChild,
  AfterViewInit,
  ElementRef,
} from '@angular/core';
import {
  IonTabs,
  IonTabBar,
  IonTabButton,
  IonIcon,
  IonLabel,
  IonRouterOutlet,
  GestureController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { people, cash, statsChart, person } from 'ionicons/icons';
import { Router, RouterLink } from '@angular/router';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

@Component({
  selector: 'app-tabs',
  templateUrl: 'tabs.page.html',
  styleUrls: ['./tabs.page.scss'],
  imports: [
    IonTabs,
    IonTabBar,
    IonTabButton,
    IonIcon,
    IonLabel,
    IonRouterOutlet,
    RouterLink,
  ],
})
export class TabsPage implements AfterViewInit {
  public environmentInjector = inject(EnvironmentInjector);

  @ViewChild('ionTabs', { read: IonTabs }) tabs!: IonTabs;
  @ViewChild('ionTabs', { read: ElementRef })
  tabsElementRef!: ElementRef<HTMLElement>;
  @ViewChild(IonRouterOutlet, { read: ElementRef })
  routerOutletRef?: ElementRef<HTMLElement>;

  private router = inject(Router);
  private gestureCtrl = inject(GestureController);

  private tabRoutes = ['tab1', 'tab2', 'tab3', 'profile'];
  private currentTabIndex = 2; // Start with tab3 (Summary)
  private isAnimating = false;
  private swipeTarget: HTMLElement | null = null;

  constructor() {
    addIcons({ people, cash, statsChart, person });
  }

  ngAfterViewInit() {
    this.swipeTarget = this.resolveSwipeTarget();
    this.setupSwipeGesture();
  }

  private setupSwipeGesture() {
    try {
      const target = this.swipeTarget ?? this.resolveSwipeTarget();

      if (!target) return;

      this.swipeTarget = target;

      const gesture = this.gestureCtrl.create({
        el: target,
        gestureName: 'swipe-tabs',
        threshold: 50,
        onStart: () => {
          if (this.isAnimating) return false;

          // Get current tab index from route
          const currentRoute = this.router.url;
          const currentTab = currentRoute.split('/').pop();
          this.currentTabIndex = this.tabRoutes.indexOf(currentTab || 'tab3');
          if (this.currentTabIndex === -1) this.currentTabIndex = 2;

          return true;
        },
        onMove: () => {
          // Optional visual feedback
        },
        onEnd: (detail: any) => {
          if (this.isAnimating) return;

          const deltaX = detail.deltaX;
          const threshold = 50;
          const velocity = Math.abs(detail.velocityX || 0);

          // Determine if we should navigate
          const shouldNavigate = Math.abs(deltaX) > threshold || velocity > 0.5;

          if (shouldNavigate) {
            if (deltaX > 0 && this.currentTabIndex > 0) {
              // Swipe right - go to previous tab
              this.navigateToTab(this.currentTabIndex - 1, 'backward');
            } else if (
              deltaX < 0 &&
              this.currentTabIndex < this.tabRoutes.length - 1
            ) {
              // Swipe left - go to next tab
              this.navigateToTab(this.currentTabIndex + 1, 'forward');
            }
          }
        },
      });

      gesture.enable(true);
    } catch (error) {
      console.log('Gesture setup error (non-critical):', error);
    }
  }

  private navigateToTab(index: number, direction?: 'forward' | 'backward') {
    if (
      this.isAnimating ||
      index < 0 ||
      index >= this.tabRoutes.length ||
      index === this.currentTabIndex
    ) {
      return;
    }

    this.isAnimating = true;
    const transitionDirection =
      direction ?? (index > this.currentTabIndex ? 'forward' : 'backward');
    const outlet = this.swipeTarget ?? this.resolveSwipeTarget();

    // Trigger haptic feedback
    this.triggerHapticFeedback();

    const exitClass =
      transitionDirection === 'forward'
        ? 'card-exit-forward'
        : 'card-exit-backward';
    const enterClass =
      transitionDirection === 'forward'
        ? 'card-enter-forward'
        : 'card-enter-backward';

    const navigate = () =>
      this.router.navigate([`/tabs/${this.tabRoutes[index]}`]).then(() => {
        this.currentTabIndex = index;
        if (outlet) {
          this.applyAnimation(outlet, enterClass, () => {
            this.isAnimating = false;
          });
        } else {
          this.isAnimating = false;
        }
      });

    if (outlet) {
      this.applyAnimation(outlet, exitClass, () => {
        navigate().catch(() => {
          this.isAnimating = false;
        });
      });
    } else {
      navigate().catch(() => {
        this.isAnimating = false;
      });
    }
  }

  private async triggerHapticFeedback() {
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch (error) {
      // Haptics not available on this platform
    }
  }

  private resolveSwipeTarget(): HTMLElement | null {
    if (this.routerOutletRef?.nativeElement) {
      return this.routerOutletRef.nativeElement;
    }

    const elementRef = this.tabsElementRef?.nativeElement;
    if (elementRef) {
      return elementRef;
    }

    const domTabs = document.querySelector('ion-tabs');
    return domTabs instanceof HTMLElement ? domTabs : null;
  }

  private applyAnimation(
    element: HTMLElement,
    animationClass: string,
    onComplete?: () => void
  ) {
    element.classList.remove(
      'slide-in-left',
      'slide-in-right',
      'slide-out-left',
      'slide-out-right',
      'card-enter-forward',
      'card-enter-backward',
      'card-exit-forward',
      'card-exit-backward'
    );
    element.classList.add(animationClass);

    let completed = false;
    const handle = () => {
      if (completed) return;
      completed = true;
      element.classList.remove(animationClass);
      element.removeEventListener('animationend', handle);
      onComplete?.();
    };

    element.addEventListener('animationend', handle, { once: true });

    // Fallback in case the animation doesn't fire (e.g., display none)
    setTimeout(handle, 400);
  }
}
