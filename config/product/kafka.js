import { DSL } from '@/store/type-map';

export const NAME = 'kafka';
export const CHART_NAME = 'strimzi-kafka-operator';

export function init(store) {
  const {
    product,
    basicType,
    virtualType,
    configureType,
  } = DSL(store, NAME);

  product({
    //TODO (Creatone): Add condition for Kafka.
    //ifHave:     IF_HAVE.V2_MONITORING, // possible RBAC issue here if mon turned on but user doesn't have view/read roles on pod monitors
    icon:       'kafka',
    weight:     90,
  });

  virtualType({
    label:      'Kafka',
    namespaced: false,
    name:       'monitoring-overview',
    weight:     105,
    route:      { name: 'c-cluster-monitoring' },
    exact:      true,
    overview:   true,
  });

  virtualType({
    label:         'Create',
    group:         'kafka',
    name:     'create',
    icon:     'globe',
    route: { name: 'c-cluster-kafka-create' }
  });

  configureType('create', { showListMasthead: false });

  basicType([
    'kafka',
    'create',
  ]);
}
