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
    //  TODO (Creatone): Add condition for Kafka.
    //  ifHave:     IF_HAVE.V2_MONITORING, // possible RBAC issue here if mon turned on but user doesn't have view/read roles on pod monitors
    icon:       'kafka',
    weight:     89,
  });

  virtualType({
    label:      'Kafka',
    namespaced: false,
    name:       'kafka',
    weight:     105,
    route:      { name: 'c-cluster-kafka' },
    exact:      true,
    overview:   true,
  });

  virtualType({
    label:         'Service',
    group:         'kafka',
    name:     'service',
    icon:     'globe',
    route: { name: 'c-cluster-kafka-service' }
  });

  configureType('service', { showListMasthead: false });

  basicType([
    'kafka',
    'service',
  ]);
}
