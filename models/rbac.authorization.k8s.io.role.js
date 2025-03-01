import { SCHEMA } from '@/config/types';
import { CATTLE_API_GROUP, SUBTYPE_MAPPING } from '@/models/management.cattle.io.roletemplate';
import { uniq } from '@/utils/array';
import SteveModel from '@/plugins/steve/steve-class';

export default class Role extends SteveModel {
  get customValidationRules() {
    return [
      {
        path:           'name',
        translationKey: 'nameNsDescription.name.label',
        required:       true,
        nullable:       false,
        type:           'string',
      },
      {
        path:           'rules',
        validators:     [`roleTemplateRules:${ this.type }`],
        nullable:       false,
        type:           'array',
      },
    ];
  }

  get nameWithinProduct() {
    return this.$rootGetters['i18n/withFallback'](`rbac.displayRole.${ this.name }`, this.name);
  }

  get subtype() {
    return SUBTYPE_MAPPING.RBAC_ROLE.key;
  }

  get allResources() {
    return this.$getters['all'](SCHEMA).filter(r => r.attributes?.kind);
  }

  get clusterResources() {
    return this.allResources.filter(r => !r.attributes.namespaced && !r.attributes.group.includes(CATTLE_API_GROUP));
  }

  get resources() {
    return uniq(this.clusterResources.map(r => r.attributes?.kind)).sort();
  }
}
