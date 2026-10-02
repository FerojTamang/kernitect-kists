import type { NavigationItem } from '../../types/navigation';

export const adminNavigation: NavigationItem[] = [
  {
    path: 'dashboard',
    label: 'Dashboard',
    description:
      'Review workforce training, completion, assessment and certification activity.',
  },
  {
    path: 'users',
    label: 'Users',
    description:
      'Create and manage trainee accounts, workplace job roles and account status.',
  },
  {
    path: 'training',
    label: 'Training content',
    description:
      'Manage learning modules, interactive scenarios and assessments.',
  },
  {
    path: 'assignments',
    label: 'Assignments',
    description:
      'Assign required or optional training modules to trainee accounts.',
  },
  {
    path: 'progress',
    label: 'Progress & results',
    description:
      'Monitor trainee learning, 360° scenario completion, assessment results and certification status.',
  },
  {
    path: 'settings',
    label: 'Settings',
    description: 'Manage your administrator profile and account security.',
  },
  {
    path: 'support',
    label: 'Support messages',
    description: 'Review and manage trainee support requests.',
  },
];
