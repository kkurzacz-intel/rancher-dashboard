import SteveModel from '@/plugins/steve/steve-class';

export const PROVIDERS = [
  {

    name:     'kafka',
    labelKey: 'kafkas.kafka.strimzi.io.kafka',
    default:  { },
  },
];

export default class Kafka extends SteveModel {
}
