/*
 * Copyright (C) 2024 - present Instructure, Inc.
 *
 * This file is part of Canvas.
 *
 * Canvas is free software: you can redistribute it and/or modify it under
 * the terms of the GNU Affero General Public License as published by the Free
 * Software Foundation, version 3 of the License.
 *
 * Canvas is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
 * details.
 *
 * You should have received a copy of the GNU Affero General Public License along
 * with this program. If not, see <http://www.gnu.org/licenses/>.
 */

import React from 'react'
import {render, screen} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CommonMigratorControls from '../CommonMigratorControls'
import {Text} from '@instructure/ui-text'

const onSubmit = vi.fn()
const onCancel = vi.fn()

const renderComponent = (overrideProps?: any) =>
  render(
    <CommonMigratorControls
      onSubmit={onSubmit}
      onCancel={onCancel}
      {...overrideProps}
      SubmitLabel={TextLabel}
      CancelLabel={TextCancelLabel}
      SubmittingLabel={TextSubmittingLabel}
    />,
  )

const TextLabel = () => <Text>Add to Import Queue</Text>
const TextSubmittingLabel = () => <Text>Submitting test</Text>
const TextCancelLabel = () => <Text>Clear</Text>

describe('CommonMigratorControls', () => {
  afterEach(() => vi.clearAllMocks())
  beforeAll(() => {
    window.ENV.SHOW_BP_SETTINGS_IMPORT_OPTION = true
  })

  afterEach(() => vi.clearAllMocks())

  it('calls onSubmit with overwrite_quizzes', async () => {
    renderComponent({canOverwriteAssessmentContent: true})

    await userEvent.click(
      screen.getByRole('checkbox', {name: /Overwrite assessment content with matching IDs/}),
    )
    await userEvent.click(screen.getByRole('button', {name: 'Add to Import Queue'}))

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        settings: expect.objectContaining({overwrite_quizzes: true}),
      }),
    )
  })

  it('calls onSubmit with date_shift_options', async () => {
    renderComponent({canAdjustDates: true})

    await userEvent.click(screen.getByRole('checkbox', {name: 'Adjust events and due dates'}))
    await userEvent.click(screen.getByRole('button', {name: 'Add to Import Queue'}))

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        date_shift_options: {
          day_substitutions: [],
          new_end_date: '',
          new_start_date: '',
          old_end_date: '',
          old_start_date: '',
        },
      }),
    )
  })

  it('calls onSubmit with selective_import', async () => {
    renderComponent({canSelectContent: true})

    await userEvent.click(screen.getByRole('radio', {name: 'Select specific content'}))
    await userEvent.click(screen.getByRole('button', {name: 'Add to Import Queue'}))

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({selective_import: true}))
  })

  it('calls onSubmit with import_blueprint_settings', async () => {
    renderComponent({canSelectContent: true, canImportBPSettings: true})
    await userEvent.click(
      await screen.getByRole('checkbox', {name: 'Import Blueprint Course settings'}),
    )
    await userEvent.click(screen.getByRole('button', {name: 'Add to Import Queue'}))

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        settings: expect.objectContaining({import_blueprint_settings: true}),
      }),
    )
  })

  it('calls onSubmit with all data', async () => {
    renderComponent({
      canSelectContent: true,
      canOverwriteAssessmentContent: true,
      canAdjustDates: true,
    })

    await userEvent.click(screen.getByRole('radio', {name: 'Select specific content'}))
    await userEvent.click(screen.getByRole('button', {name: 'Add to Import Queue'}))

    expect(onSubmit).toHaveBeenCalledWith({
      adjust_dates: {
        enabled: false,
        operation: 'shift_dates',
      },
      selective_import: true,
      date_shift_options: {
        day_substitutions: [],
        new_end_date: '',
        new_start_date: '',
        old_end_date: '',
        old_start_date: '',
      },
      errored: false,
      settings: {overwrite_quizzes: false},
    })
  })

  it('calls onCancel', async () => {
    renderComponent()
    await userEvent.click(screen.getByRole('button', {name: 'Clear'}))
    expect(onCancel).toHaveBeenCalled()
  })

  it('disable all common fields while uploading', async () => {
    renderComponent({isSubmitting: true, canSelectContent: true})
    expect(screen.getByRole('radio', {name: 'Select specific content'})).toBeInTheDocument()
    expect(screen.getByRole('radio', {name: /All content/})).toBeDisabled()
    expect(screen.getByRole('radio', {name: 'Select specific content'})).toBeDisabled()
    expect(screen.getByRole('button', {name: 'Clear'})).toBeDisabled()
    expect(screen.getByRole('button', {name: /Submitting test/})).toBeDisabled()
  })

  it('disable "events and due" dates optional fields while uploading', async () => {
    const props = {
      canSelectContent: true,
      canImportBPSettings: true,
      canAdjustDates: true,
      canOverwriteAssessmentContent: true,
      oldStartDate: '',
      oldEndDate: '',
      newStartDate: '',
      newEndDate: '',
    }
    const {rerender, getByLabelText, getByRole} = renderComponent(props)
    await userEvent.click(getByRole('checkbox', {name: 'Adjust events and due dates'}))
    rerender(
      <CommonMigratorControls
        onSubmit={onSubmit}
        onCancel={onCancel}
        {...props}
        isSubmitting={true}
        fileUploadProgress={10}
        SubmitLabel={TextLabel}
        SubmittingLabel={TextSubmittingLabel}
        CancelLabel={TextCancelLabel}
      />,
    )
    expect(getByRole('radio', {name: 'Shift dates'})).toBeInTheDocument()
    expect(getByRole('radio', {name: 'Shift dates'})).toBeDisabled()
    expect(getByRole('radio', {name: 'Remove dates'})).toBeDisabled()
    expect(getByLabelText('Select original beginning date')).toBeDisabled()
    expect(getByLabelText('Select new beginning date')).toBeDisabled()
    expect(getByLabelText('Select original end date')).toBeDisabled()
    expect(getByLabelText('Select new end date')).toBeDisabled()
    expect(getByRole('button', {name: 'Add substitution'})).toBeDisabled()
  })
  it('disable other optional fields while uploading', async () => {
    const props = {
      canSelectContent: true,
      canImportBPSettings: true,
      canAdjustDates: true,
      canOverwriteAssessmentContent: true,
      oldStartDate: '',
      oldEndDate: '',
      newStartDate: '',
      newEndDate: '',
    }
    const {rerender, getByLabelText, getByRole} = renderComponent(props)
    await userEvent.click(getByLabelText(/All content/))
    await userEvent.click(getByRole('checkbox', {name: 'Import Blueprint Course settings'}))
    rerender(
      <CommonMigratorControls
        onSubmit={onSubmit}
        onCancel={onCancel}
        {...props}
        isSubmitting={true}
        fileUploadProgress={10}
        SubmitLabel={TextLabel}
        SubmittingLabel={TextSubmittingLabel}
        CancelLabel={TextCancelLabel}
      />,
    )
    expect(getByRole('checkbox', {name: 'Import Blueprint Course settings'})).toBeDisabled()
    expect(
      getByRole('checkbox', {name: /Overwrite assessment content with matching IDs/}),
    ).toBeDisabled()
  })

  describe('Date fill in', () => {
    const oldStartDateInputSting = '2024-08-08T08:00:00+00:00'
    const oldStartDateExpectedDate = 'Aug 8, 2024 at 8am'
    const oldEndDateInputSting = '2024-08-09T08:00:00+00:00'
    const oldEndDateExpectedDate = 'Aug 9, 2024 at 8am'
    const newStartDateInputSting = '2024-08-10T08:00:00+00:00'
    const newStartDateExpectedDate = 'Aug 10, 2024 at 8am'
    const newEndDateInputSting = '2024-08-11T08:00:00+00:00'
    const newEndDateExpectedDate = 'Aug 11, 2024 at 8am'

    const expectDateField = (dataCid: string, value: string) => {
      expect((screen.getByTestId(dataCid) as HTMLInputElement).value).toBe(value)
    }

    describe('when dates are not provided', () => {
      const props = {
        canAdjustDates: true,
        oldStartDate: undefined,
        oldEndDate: undefined,
        newStartDate: undefined,
        newEndDate: undefined,
      }

      beforeEach(async () => {
        const {getByRole} = renderComponent(props)
        await userEvent.click(getByRole('checkbox', {name: 'Adjust events and due dates'}))
      })

      it('not fills the original beginning date', () => {
        expectDateField('old_start_date', '')
      })

      it('not fills the original end date', () => {
        expectDateField('old_end_date', '')
      })

      it('not fills the new beginning date', () => {
        expectDateField('new_start_date', '')
      })

      it('not fills the new end date', () => {
        expectDateField('new_end_date', '')
      })
    })

    describe('when dates are provided', () => {
      const props = {
        canAdjustDates: true,
        oldStartDate: oldStartDateInputSting,
        oldEndDate: oldEndDateInputSting,
        newStartDate: newStartDateInputSting,
        newEndDate: newEndDateInputSting,
      }

      beforeEach(async () => {
        const {getByRole} = renderComponent(props)
        await userEvent.click(getByRole('checkbox', {name: 'Adjust events and due dates'}))
      })

      it('not fills the original beginning date', () => {
        expectDateField('old_start_date', oldStartDateExpectedDate)
      })

      it('not fills the original end date', () => {
        expectDateField('old_end_date', oldEndDateExpectedDate)
      })

      it('not fills the new beginning date', () => {
        expectDateField('new_start_date', newStartDateExpectedDate)
      })

      it('not fills the new end date', () => {
        expectDateField('new_end_date', newEndDateExpectedDate)
      })
    })
  })
})
