import React, { ChangeEvent, PureComponent } from 'react';
import { LegacyForms } from '@grafana/ui';
import { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { LFDataSourceOptions, LFSecureJsonData } from '../types';

const { SecretFormField, FormField } = LegacyForms;

interface Props extends DataSourcePluginOptionsEditorProps<LFDataSourceOptions> { }

interface State { }

export class ConfigEditor extends PureComponent<Props, State> {
  onPathChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onOptionsChange, options } = this.props;
    const jsonData = {
      ...options.jsonData,
      path: event.target.value,
    };
    onOptionsChange({ ...options, jsonData });
  };

  // Secure field (only sent to the backend)
  onAPIKeyChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onOptionsChange, options } = this.props;
    onOptionsChange({
      ...options,
      secureJsonData: {
        apiKey: event.target.value,
      },
    });
  };

  onResetAPIKey = () => {
    const { onOptionsChange, options } = this.props;
    onOptionsChange({
      ...options,
      secureJsonFields: {
        ...options.secureJsonFields,
        apiKey: false,
      },
      secureJsonData: {
        ...options.secureJsonData,
        apiKey: '',
      },
    });
  };

  onURLChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onOptionsChange, options } = this.props;
    const jsonData = {
      ...options.jsonData,
      url: event.target.value,
    };
    onOptionsChange({ ...options, jsonData });
  };

  onUserChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onOptionsChange, options } = this.props;
    const jsonData = {
      ...options.jsonData,
      user: event.target.value,
    };
    onOptionsChange({ ...options, jsonData });
  };

  onPasswordChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onOptionsChange, options } = this.props;
    const jsonData = {
      ...options.jsonData,
      password: event.target.value,
    };
    onOptionsChange({ ...options, jsonData });
  };

  render() {
    const { options } = this.props;
    const { jsonData, secureJsonFields } = options;
    const secureJsonData = (options.secureJsonData || {}) as LFSecureJsonData;

    return (
      <div className="gf-form-group">
        <div className="gf-form">
          <FormField
            label="URL"
            labelWidth={6}
            inputWidth={20}
            onChange={this.onURLChange}
            value={jsonData.url || ''}
            placeholder="URL of LinkedFactory"
          />
        </div>

        <div className="gf-form">
          <FormField
            label="User"
            labelWidth={6}
            inputWidth={20}
            onChange={this.onUserChange}
            value={jsonData.user || ''}
            placeholder="Basic user"
          />
        </div>

        <div className="gf-form">
          <FormField
            label="Password"
            labelWidth={6}
            inputWidth={20}
            onChange={this.onPasswordChange}
            value={jsonData.password || ''}
            placeholder="Basic password"
          />
        </div>

        <div className="gf-form-inline">
          <div className="gf-form">
            <SecretFormField
              isConfigured={(secureJsonFields && secureJsonFields.apiKey) as boolean}
              value={secureJsonData.apiKey || ''}
              label="API Key"
              placeholder="secure json field (backend only)"
              labelWidth={6}
              inputWidth={20}
              onReset={this.onResetAPIKey}
              onChange={this.onAPIKeyChange}
            />
          </div>
        </div>
      </div>
    );
  }
}
