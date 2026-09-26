/*
 * Copyright (C) 2026 - present quite frankly an example LMS contributors
 *
 * This file is part of quite frankly an example LMS, a modified version of Canvas.
 *
 * quite frankly an example LMS is free software: you can redistribute it and/or modify it under
 * the terms of the GNU Affero General Public License as published by the Free
 * Software Foundation, version 3 of the License.
 *
 * quite frankly an example LMS is distributed in the hope that it will be useful, but WITHOUT ANY
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
import ParentSignupApp, {type SignupConfig} from '../ParentSignupApp'

const config: SignupConfig = {
  valid: true,
  student_first_name: 'Maya',
  signed_in_as: null,
  submit_url: '/parents/join/abc123',
  login_url: '/login?redirect=%2Fparents%2Fjoin%2Fabc123',
  authenticity_token: 'token',
  password_policy: {minimum_character_length: '10'},
}

async function fill(
  name = 'Pat Kim',
  email = 'pat@example.com',
  password = 'longenough1',
  confirm = password,
) {
  await userEvent.type(screen.getByLabelText('Your full name'), name)
  await userEvent.type(screen.getByLabelText('Email'), email)
  await userEvent.type(screen.getByLabelText('Password'), password)
  await userEvent.type(screen.getByLabelText('Type your password again'), confirm)
}

describe('ParentSignupApp', () => {
  it('names the student and asks for the parent details', () => {
    render(<ParentSignupApp config={config} />)

    expect(screen.getByRole('heading', {name: "Follow Maya's progress"})).toBeInTheDocument()
    expect(screen.getByText('At least 10 characters.')).toBeInTheDocument()
  })

  it('sends the details and goes where the server says', async () => {
    const post = jest.fn().mockResolvedValue({ok: true, errors: [], redirect: '/'})
    const go = jest.fn()
    render(<ParentSignupApp config={config} post={post} go={go} />)
    await fill()
    await userEvent.click(screen.getByRole('button', {name: 'Create my account'}))

    expect(post).toHaveBeenCalledWith({
      name: 'Pat Kim',
      email: 'pat@example.com',
      password: 'longenough1',
      password_confirmation: 'longenough1',
    })
    expect(go).toHaveBeenCalledWith('/')
  })

  it("won't send passwords that don't match", async () => {
    const post = jest.fn()
    render(<ParentSignupApp config={config} post={post} />)
    await fill('Pat Kim', 'pat@example.com', 'longenough1', 'different123')
    await userEvent.click(screen.getByRole('button', {name: 'Create my account'}))

    expect(post).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent("The passwords don't match.")
  })

  it('shows what the server says is wrong and lets them try again', async () => {
    const post = jest.fn().mockResolvedValue({ok: false, errors: ['Enter a valid email address.']})
    const go = jest.fn()
    render(<ParentSignupApp config={config} post={post} go={go} />)
    await fill()
    await userEvent.click(screen.getByRole('button', {name: 'Create my account'}))

    expect(await screen.findByRole('alert')).toHaveTextContent('Enter a valid email address.')
    expect(go).not.toHaveBeenCalled()
    expect(screen.getByRole('button', {name: 'Create my account'})).toBeEnabled()
  })

  it('says so when the invitation is used up or expired', () => {
    render(<ParentSignupApp config={{...config, valid: false, student_first_name: null}} />)

    expect(screen.getByTestId('signup-invalid')).toBeInTheDocument()
    expect(screen.queryByLabelText('Email')).not.toBeInTheDocument()
  })

  it('offers to add the student to the account someone is already signed in with', async () => {
    const post = jest.fn().mockResolvedValue({ok: true, errors: [], redirect: '/'})
    const go = jest.fn()
    render(<ParentSignupApp config={{...config, signed_in_as: 'Pat Kim'}} post={post} go={go} />)

    expect(screen.getByText(/You're signed in as Pat Kim/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', {name: 'Add Maya'}))

    expect(post).toHaveBeenCalledWith({})
    expect(go).toHaveBeenCalledWith('/')
  })

  it('links to log in for parents who already have an account', () => {
    render(<ParentSignupApp config={config} />)

    expect(screen.getByRole('link', {name: 'Log in to add Maya'})).toHaveAttribute(
      'href',
      config.login_url,
    )
  })
})
