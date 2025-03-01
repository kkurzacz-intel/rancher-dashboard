<script>
import Jexl from 'jexl';
import Tab from '@/components/Tabbed/Tab';
import { get, set } from '@/utils/object';
import sortBy from 'lodash/sortBy';
import { _EDIT } from '@/config/query-params';
import StringType from './String';
import BooleanType from './Boolean';
import EnumType from './Enum';
import IntType from './Int';
import FloatType from './Float';
import ArrayType from './Array';
import MapType from './Map';
import ReferenceType from './Reference';
import CloudCredentialType from './CloudCredential';

export const knownTypes = {
  string:          StringType,
  hostname:        StringType, // @TODO
  multiline:       StringType,
  password:        StringType,
  boolean:         BooleanType,
  enum:            EnumType,
  int:             IntType,
  float:           FloatType,
  map:             MapType,
  reference:       ReferenceType,
  configmap:       ReferenceType,
  secret:          ReferenceType,
  storageclass:    ReferenceType,
  pvc:             ReferenceType,
  cloudcredential: CloudCredentialType,
};

export function componentForQuestion(q) {
  const type = (q.type || '').toLowerCase();

  if ( knownTypes[type] ) {
    return type;
  } else if ( type.startsWith('array[') ) { // This only really works for array[string|multiline], but close enough for now.
    return ArrayType;
  } else if ( type.startsWith('map[') ) { // Same, only works with map[string|multiline]
    return MapType;
  } else if ( type.startsWith('reference[') ) { // Same, only works with map[string|multiline]
    return ReferenceType;
  }

  return 'string';
}

export function schemaToQuestions(fields) {
  const keys = Object.keys(fields);
  const out = [];

  for ( const k of keys ) {
    out.push({
      variable: k,
      label:    k,
      ...fields[k],
    });
  }

  return out;
}

function evalExpr(expr, values) {
  try {
    const out = Jexl.evalSync(expr, values);

    // console.log('Eval', expr, '=> ', out);

    return out;
  } catch (err) {
    console.error('Error evaluating expression:', expr, values); // eslint-disable-line no-console

    return true;
  }
}

function shouldShow(q, values) {
  let expr = q.if;

  if ( expr === undefined && q.show_if !== undefined ) {
    expr = migrate(q.show_if);
  }

  if ( expr ) {
    const shown = !!evalExpr(expr, values);

    return shown;
  }

  return true;
}

function shouldShowSub(q, values) {
  // Sigh, both singular and plural are used in the wild...
  let expr = ( q.subquestions_if === undefined ? q.subquestion_if : q.subquestions_if);
  const old = ( q.show_subquestions_if === undefined ? q.show_subquestion_if : q.show_subquestions_if);

  if ( !expr && old !== undefined ) {
    if ( old === false || old === 'false' ) {
      expr = `!${ q.variable }`;
    } else if ( old === true || old === 'true' ) {
      expr = `!!${ q.variable }`;
    } else {
      expr = `${ q.variable } == "${ old }"`;
    }
  }

  if ( expr ) {
    return evalExpr(expr, values);
  }

  return true;
}

function migrate(expr) {
  let out;

  if ( expr.includes('||') ) {
    out = expr.split('||').map(x => migrate(x)).join(' || ');
  } else if ( expr.includes('&&') ) {
    out = expr.split('&&').map(x => migrate(x)).join(' && ');
  } else {
    const parts = expr.match(/^(.*)(!?=)(.*)$/);

    if ( parts ) {
      const key = parts[1].trim();
      const op = parts[2].trim() === '!=' ? '!=' : '==';
      const val = parts[3].trim();

      if ( val === 'true' || val === 'false' || val === 'null' ) {
        out = `${ key } ${ op } ${ val }`;
      } else if ( val === '' ) {
        // Existing charts expect `foo=` with `{foo: null}` to be true.
        if ( op === '!=' ) {
          out = `!!${ key }`;
        } else {
          out = `!${ key }`;
        }
        // out = `${ op === '!' ? '!' : '' }(${ key } == "" || ${ key } == null)`;
      } else {
        out = `${ key } ${ op } "${ val }"`;
      }
    } else {
      try {
        Jexl.compile(expr);

        out = expr;
      } catch (e) {
        console.error('Error migrating expression:', expr); // eslint-disable-line no-console

        out = 'true';
      }
    }
  }

  return out;
}

export default {
  components: { Tab, ...knownTypes },

  props: {
    mode: {
      type:    String,
      default: _EDIT,
    },

    value: {
      type:     Object,
      required: true,
    },

    tabbed: {
      type:    [Boolean, String],
      default: true,
    },

    // Can be a chartVersion or a resource Schema
    source: {
      type:     Object,
      required: true,
    },

    targetNamespace: {
      type:     String,
      required: true
    },

    ignoreVariables: {
      type:    Array,
      default: () => [],
    },

    disabled: {
      type:    Boolean,
      default: false,
    },

    inStore: {
      type:    String,
      default: 'cluster'
    }
  },

  data() {
    return { valueGeneration: 0 };
  },

  computed: {
    allQuestions() {
      if ( this.source.questions?.questions ) {
        return this.source.questions.questions;
      } else if ( this.source.type === 'schema' && this.source.resourceFields ) {
        return schemaToQuestions(this.source.resourceFields);
      } else if ( typeof this.source === 'object' ) {
        return schemaToQuestions(this.source);
      } else {
        return [];
      }
    },

    shownQuestions() {
      const values = this.value;

      if ( this.valueGeneration < 0 ) {
        // Pointless condition to get this to depend on generation and recompute
        return;
      }

      const out = [];

      for ( const q of this.allQuestions ) {
        if ( this.ignoreVariables.includes(q.variable) ) {
          continue;
        }

        addQuestion(q);
      }

      return out;

      function addQuestion(q, depth = 1, parentGroup) {
        if ( !shouldShow(q, values) ) {
          return;
        }

        q.depth = depth;
        q.group = q.group || parentGroup;

        out.push(q);

        if ( q.subquestions?.length && shouldShowSub(q, values) ) {
          for ( const sub of q.subquestions ) {
            addQuestion(sub, depth + 1, q.group);
          }
        }
      }
    },

    groups() {
      const map = {};
      const defaultGroup = 'Questions';
      let weight = this.shownQuestions.length;

      for ( const q of this.shownQuestions ) {
        const group = q.group || defaultGroup;

        const normalized = group.trim().toLowerCase();

        if ( !map[normalized] ) {
          map[normalized] = {
            name:      group,
            questions: [],
            weight:    weight--,
          };
        }

        map[normalized].questions.push(q);
      }

      const out = Object.values(map);

      return sortBy(out, 'weight:desc');
    },

    asTabs() {
      if ( this.tabbed === false || this.tabbed === 'never' ) {
        return false;
      }

      if ( this.tabbed === 'multiple' ) {
        return this.groups.length > 1;
      }

      return true;
    },
  },

  watch: {
    value: {
      deep: true,

      handler() {
        this.valueGeneration++;
      },
    }
  },

  methods: {
    get,
    set,
    componentForQuestion,
  },
};
</script>

<template>
  <form v-if="asTabs">
    <Tab
      v-for="g in groups"
      :key="g.name"
      :name="g.name"
      :label="g.name"
      :weight="g.weight"
    >
      <div v-for="q in g.questions" :key="q.variable" class="row question">
        <div class="col span-12">
          <component
            :is="componentForQuestion(q)"
            :in-store="inStore"
            :question="q"
            :target-namespace="targetNamespace"
            :value="get(value, q.variable)"
            :disabled="disabled"
            @input="set(value, q.variable, $event)"
          />
        </div>
      </div>
    </Tab>
  </form>
  <form v-else>
    <div
      v-for="g in groups"
      :key="g.name"
    >
      <h3 v-if="groups.length > 1">
        {{ g.label }}
      </h3>
      <div v-for="q in g.questions" :key="q.variable" class="row question">
        <div class="col span-12">
          <component
            :is="componentForQuestion(q)"
            :in-store="inStore"
            :question="q"
            :target-namespace="targetNamespace"
            :mode="mode"
            :value="get(value, q.variable)"
            :disabled="disabled"
            @input="set(value, q.variable, $event)"
          />
        </div>
      </div>
    </div>
  </form>
</template>

<style lang="scss" scoped>
  .question {
    margin-top: 10px;

    &:first-child {
      margin-top: 0;
    }
  }
</style>
