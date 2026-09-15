import type { NavigationItem } from '../../types/navigation';

export const adminNavigation: NavigationItem[] = [
  {
    path: 'dashboard',
    label: 'Dashboard',
    description:
      'An overview of workforce training and safety learning will appear here.',
  },
  {
    path: 'users',
    label: 'Users',
    description:
      'Administrator tools for managing trainees, system roles and job roles will appear here.',
  },
  {
    path: 'training',
    label: 'Training content',
    description:
      'Tools for managing training content and learning activities will appear here.',
  },
  {
    path: 'assignments',
    label: 'Assignments',
    description:
      'Tools for assigning required training by trainee job role will appear here.',
  },
  {
    path: 'progress',
    label: 'Progress & results',
    description:
      'Tools for monitoring trainee progress and assessment results will appear here.',
  },
];
