import React from "react"
import timeSince from '../resources/timeSince'

function Article(props) {
    return(
        <article>
            <a href={ "https://reddit.com" + props.article.permalink } target="_blank">
                <h3>{props.article.title}</h3>
                <span>{(timeSince(props.article.created))} ago</span>
            </a>
        </article>
    )
}

export default Article