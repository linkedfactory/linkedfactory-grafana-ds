import defaults from 'lodash/defaults';

import { css, cx } from '@emotion/css';
import { GrafanaTheme2, QueryEditorProps, SelectableValue } from '@grafana/data';
import { BackendSrvRequest, getBackendSrv } from '@grafana/runtime';
import { Button, Combobox, ComboboxOption, Label, MultiCombobox, RadioButtonGroup, SegmentInput, SegmentSection, useStyles2 } from '@grafana/ui';
import React, { useEffect, useRef, useState } from 'react';
import { DataSource } from '../datasource';
import { DEFAULT_MODEL, defaultQuery, LFDataSourceOptions, LFQuery } from '../types';

import { EMPTY, firstValueFrom } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import "@triply/yasgui/build/yasgui.min.css";
import { PartialConfig, default as Yasqe } from "@triply/yasqe";
import "codemirror/theme/dracula.css";

type Props = QueryEditorProps<DataSource, LFQuery, LFDataSourceOptions>;

export const QueryEditor = (props: Props): React.JSX.Element => {
  function getStyles(theme: GrafanaTheme2) {
    return {
      inlineLabel: css`
        color: ${theme.colors.primary.text};
      `,
      sectionContent: cx('gf-form', css`
        flex: 1 1 auto;
        gap: 4px;
      `),
    };
  }

  const styles = useStyles2(getStyles);

  const { query, datasource } = props;
  const { propertyPath, item, model } = query;

  const [items, setItems] = useState([] as Array<ComboboxOption<string>>);
  const [properties, setProperties] = useState([] as Array<Array<ComboboxOption<string>>>);

  useEffect(() => {
    // get all items
    async function loadItems(): Promise<Array<ComboboxOption<string>>> {
      const settings = datasource.settings;
      const url = datasource.url!.replace(/\/?$/, '/**');
      const options: BackendSrvRequest = {
        url: url,
        method: 'GET'
      }

      if (settings.jsonData.user) {
        options.headers = { 'Authorization': 'Basic ' + btoa(settings.jsonData.user + ":" + settings.jsonData.password) }
      }

      const baseItems = item ? [item] : [];
      return firstValueFrom(getBackendSrv().fetch<any>(options).pipe(map(response => {
        return baseItems.concat(response.data.filter((e: any) => e['@id'] !== item).map((e: any) => e['@id'])).map((id: string) => {
          return { label: id, value: id };
        });
      }),
        catchError((e, caught) => EMPTY)));
    }

    loadItems().then(itemOptions => {
      setItems(itemOptions);
    }).catch(e => {
      // ignore errors fetching the items
    })
  }, [item, datasource]);

  useEffect(() => {
    // get properties for a given item
    async function loadProperties(index: number): Promise<Array<ComboboxOption<string>>> {
      const localPropertyPath = index === 0 ? undefined : propertyPath.slice(0, index)
      if (localPropertyPath) {
        // signal that we want any property
        localPropertyPath.push(["*"])
      }
      return firstValueFrom(datasource.queryProperties(model || DEFAULT_MODEL, item, localPropertyPath).pipe(map(properties => {
        if (propertyPath && index < propertyPath.length) {
          const pathProperty = propertyPath[index];
          if (!properties.includes(pathProperty.toString())) {
            properties.push(pathProperty.toString());
          }
        }
        // sort the properties
        properties.sort();
        return properties.map(p => {
          let option = { label: p, value: p };
          return option;
        });
      })));
    }

    const promises: Array<Promise<Array<ComboboxOption<string>>>> = [];
    if (item) {
      promises.push(loadProperties(0));
      if (propertyPath && propertyPath.length) {
        for (let i = 1; i < propertyPath.length; i++) {
          promises.push(loadProperties(i));
        }
      }
    }
    Promise.all(promises).then(propertyOptions => {
      setProperties(propertyOptions);
    });
  }, [model, item, propertyPath, datasource]);

  const operators = ["-", "min", "max", "avg", "sum"];
  const operatorOptions: Array<ComboboxOption<string>> = operators.map(o => ({ label: o, value: o }));

  const onItemChange = (value: ComboboxOption<string>) => {
    const { onChange, query, onRunQuery } = props;
    query.item = value.value!.toString();
    onChange({ ...query });
    onRunQuery();
  }

  function onPropertyChange(index: number) {
    return (value: Array<SelectableValue<string>>) => {
      const { onChange, query, onRunQuery } = props;
      let pathProps: string[] = [];
      value.forEach(v => {
        pathProps.push(v.value!)
      });
      query.propertyPath[index] = pathProps;
      onChange({ ...query });
      onRunQuery();
    };
  }

  const onOperatorChange = (value: SelectableValue<String>) => {
    const { onChange, query, onRunQuery } = props;
    query.operator = value.value!.toString();
    onChange({ ...query });
    onRunQuery();
  }

  const pushPath = () => {
    const { onChange, query } = props;
    query.propertyPath.push([]);
    onChange({ ...query, propertyPath: query.propertyPath.slice() });
  }

  const popPath = () => {
    const { onChange, query } = props;
    query.propertyPath.pop();
    onChange({ ...query, propertyPath: query.propertyPath.slice() });
  }

  const localQuery = defaults(props.query, defaultQuery);

  const handleQueryTypeChange = (value: string) => {
    const { onChange, query } = props;
    onChange({ ...query, type: value as any })
  };

  const handleModelChange = (value: string | number) => {
    const { onChange, query } = props;
    onChange({ ...query, model: value.toString() })
  };

  const Kvin = () => {
    return (
      <div>
        <SegmentSection label="Query">
          <div className={styles.sectionContent}>
            <Combobox options={items} onChange={onItemChange} placeholder="Item" value={localQuery.item} createCustomValue={true} />
            {query.propertyPath.map((p, pathIndex) => {
              return <>{pathIndex > 0 ? <span>&nbsp;/&nbsp;</span> : <span></span>}
                <MultiCombobox key={pathIndex} options={properties[pathIndex] || []} onChange={onPropertyChange(pathIndex)}
                  placeholder="Property" value={p} createCustomValue={true} />
              </>
            })}
            {query.propertyPath.length > 1 ? <Button className="gf-form-btn" onClick={popPath} icon='trash-alt' aria-label="Remove path element"></Button> : null}
            <Button className="gf-form-btn" onClick={pushPath}>/</Button>
          </div>
        </SegmentSection>
        <SegmentSection label="Transform">
          <div className={styles.sectionContent}>
            <Combobox options={operatorOptions} onChange={onOperatorChange} placeholder="Operator" value={query.operator || 'avg'} />
          </div>
        </SegmentSection>
      </div>
    );
  };

  class YasqeCustom extends Yasqe {
    constructor(parent: HTMLElement, conf: PartialConfig = {}) {
      super(parent, conf);
      this.saveQuery = () => {
        // apply and execute SPARQL query
        const { onChange, query, onRunQuery } = props;
        query.sparql = this.getValue();
        onChange({ ...query });
        onRunQuery();
      }
    }
  }

  const Query = () => {
    const containerRef = useRef(null);
    useEffect(() => {
      const editor = new YasqeCustom(containerRef.current!, {
        createShareableLink: false,
        editorHeight: "200",
        resizeable: false,
        persistenceId: null,
        showQueryButton: false,
      });
      (editor as any).setOption('theme', 'dracula');
      editor.setValue(query.sparql || '');
      return () => { };
    }, []);

    const sparqlEndpoint = `${datasource.url}`.replace(/linkedfactory\//, "sparql") + "?model=http://linkedfactory.github.io/data/";

    return (
      <div>
        <SegmentSection label="Endpoint">
          <Label>{sparqlEndpoint}</Label>
        </SegmentSection>
        <div ref={containerRef}></div>
      </div>
    );
  };

  const options = [
    { label: 'KVIN', value: 'kvin' },
    { label: 'SPARQL', value: 'sparql' }
  ];

  return (
    <div>
      <SegmentSection label="Type">
        <div className={styles.sectionContent}>
          <RadioButtonGroup options={options} value={query.type} onChange={handleQueryTypeChange} />
        </div>
      </SegmentSection>
      <SegmentSection label="Model">
        <div className={styles.sectionContent}>
          <SegmentInput
            onChange={handleModelChange}
            placeholder="The LF model"
            value={query.model || DEFAULT_MODEL}></SegmentInput>
        </div>
      </SegmentSection>
      {query.type === "kvin" && <Kvin />}
      {query.type === "sparql" && <Query />}
    </div>
  );
}
