import type { NavigationItem } from '../../types/navigation';

export const traineeNavigation: NavigationItem[] = [
  {
    path: 'dashboard',
    label: 'Dashboard',
    description:
      'Your safety learning starts here. Assigned training and next steps will appear here in a later phase.',
  },
  {
    path: 'training',
    label: 'My training',
    description:
      'Assigned learning content and warehouse safety activities will appear here.',
  },
  {
    path: 'progress',
    label: 'My progress',
    description: 'Training completion and assessment results will appear here.',
  },
  {
    path: 'certificates',
    label: 'Certificates',
    description:
      'Digital certification will become available after all required assigned training and assessment conditions are met.',
  },
];
